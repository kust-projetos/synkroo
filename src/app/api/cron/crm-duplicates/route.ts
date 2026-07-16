/**
 * POST /api/cron/crm-duplicates — reprocess duplicate suggestions (cron)
 * GET  /api/cron/crm-duplicates — health check
 *
 * Task 4 / Eixo 2 Integration Closure — cron CRM via action system:
 *  - Bearer CRON_SECRET via crypto.timingSafeEqual.
 *  - assertModuleForJob('crm', moduleManifest) gate → { skipped: true } se
 *    módulo desabilitado.
 *  - Lista clinicIds com sugestões pendentes.
 *  - Para cada clinicId: buildSystemContext + runAction da action
 *    system-only `crm.reprocessarSugestoesDuplicidade`.
 *  - Erros por clínica são logados e o loop continua (resultado.ok=false).
 *  - Zero clínicas → { processed: 0, results: [] }.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { listClinicIdsWithPendingSuggestions } from '@/modules/crm/repositories/duplicate-suggestions-repository';
import { reprocessarSugestoesDuplicidade } from '@/modules/crm/actions';
import { buildSystemContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';
import { assertModuleForJob, ModuleDisabledError } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

interface ClinicResult {
  clinicId: string;
  ok: boolean;
  evaluated?: number;
  dismissed?: number;
  error?: string;
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  // Rate limit cron endpoints
  const rateLimit = checkRateLimit('cron', rateLimitPresets.cron);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

  // Secure gate — CRON_SECRET via timingSafeEqual
  const auth = request.headers.get('Authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (
    !process.env.CRON_SECRET ||
    auth.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Module gate — skip when CRM not contracted
  try {
    await assertModuleForJob('crm', moduleManifest);
  } catch (err) {
    if (err instanceof ModuleDisabledError) {
      logger.info('[cron/crm-duplicates] skipped: crm module disabled');
      return NextResponse.json(
        {
          success: true,
          skipped: true,
          reason: 'crm module disabled',
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }
    throw err;
  }

  // List clinics with pending suggestions
  const clinicIds = await listClinicIdsWithPendingSuggestions();
  const results: ClinicResult[] = [];

  for (const clinicId of clinicIds) {
    try {
      const ctx = await buildSystemContext(clinicId);
      const actionResult = await runAction(
        reprocessarSugestoesDuplicidade,
        { clinicId },
        ctx,
      );
      if (actionResult.ok) {
        const data = actionResult.data as { evaluated?: number; dismissed?: number };
        results.push({
          clinicId,
          ok: true,
          evaluated: data.evaluated,
          dismissed: data.dismissed,
        });
      } else {
        logger.warn(
          `[cron/crm-duplicates] clinic ${clinicId} action returned error`,
          { error: actionResult.error.code, message: actionResult.error.message },
        );
        results.push({
          clinicId,
          ok: false,
          error: actionResult.error.message ?? actionResult.error.code,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(
        `[cron/crm-duplicates] clinic ${clinicId} threw`,
        err,
      );
      results.push({ clinicId, ok: false, error: msg });
    }
  }

  return NextResponse.json(
    {
      success: true,
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}

async function handleGET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    message: 'CRM duplicates cron endpoint is active',
    timestamp: new Date().toISOString(),
  });
}

export const POST = handlePOST;
export const GET = handleGET;