/**
 * POST /api/cron/crm-duplicates — reprocess duplicate suggestions per clinic (cron)
 * GET  /api/cron/crm-duplicates — health check
 *
 * Security: CRON_SECRET Bearer token verification via timingSafeEqual.
 * Per-clinic: buildSystemContext + runAction(reprocessarSugestoesDuplicidade).
 * Continues after individual clinic failure.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit';
import { apiRateLimited, generateRequestId } from '@/lib/api/response';
import { listClinicIdsWithPendingSuggestions } from '@/modules/crm/repositories/duplicate-suggestions-repository';
import { reprocessarSugestoesDuplicidade } from '@/modules/crm/actions';
import { buildSystemContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';
import { assertModuleForJob, ModuleDisabledError } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  // Verify CRON_SECRET before rate limit — invalid credentials must not consume scheduler quota (T1 DoS fix).
  const auth = request.headers.get('Authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (
    !process.env.CRON_SECRET ||
    auth.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimit = checkRateLimit('cron', rateLimitPresets.cron);
  if (!rateLimit.allowed) {
    return apiRateLimited(generateRequestId(), rateLimit.retryAfter);
  }

  try {
    await assertModuleForJob('crm', createManifest());
  } catch (err) {
    if (err instanceof ModuleDisabledError) {
      return NextResponse.json({ skipped: true }, { status: 200 });
    }
    throw err;
  }

  const clinicIds = await listClinicIdsWithPendingSuggestions();

  if (clinicIds.length === 0) {
    return NextResponse.json({ processed: 0, results: [] }, { status: 200 });
  }

  const results: Array<{ clinicId: string; ok: boolean; data?: unknown; error?: string }> = [];

  for (const clinicId of clinicIds) {
    try {
      const ctx = await buildSystemContext(clinicId);
      const result = await runAction(reprocessarSugestoesDuplicidade, {}, ctx);
      results.push({
        clinicId,
        ok: result.ok,
        ...(result.ok ? { data: result.data } : { error: result.error?.message ?? 'unknown' }),
      });
    } catch (err) {
      results.push({
        clinicId,
        ok: false,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  return NextResponse.json({ processed: clinicIds.length, results }, { status: 200 });
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
