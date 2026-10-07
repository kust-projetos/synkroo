/**
 * POST /api/cron/followups
 * Cron job endpoint to process follow-ups, inactivity detection, and campaigns.
 *
 * Runs each active task per non-deleted clinic using the action layer with a
 * narrowly allowlisted cron context (buildCronContext).
 *
 * Recommended schedule:
 * - Every 5 minutes for post-consultation follow-ups
 * - Daily at 8am for return reminders
 * - Daily at 6am for inactivity detection
 * - Every 30 minutes for scheduled campaigns
 *
 * Security: CRON_SECRET Bearer token + module gate (skips if followup disabled).
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runAction } from '@/core/actions/run';
import type { ActionDefinition } from '@/core/actions/types';
import { buildCronContext } from '@/core/actions/context';
import { getDb } from '@/lib/db/client';
import { eq, isNull } from 'drizzle-orm';
import { clinics } from '@/lib/db/schema/core';
import { processarNotificacoesLeadsQuentes } from '@/modules/comercial';
import { assertModuleForJob } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { apiSuccess, apiFailure, apiRateLimited, generateRequestId } from '@/lib/api/response';
import { executarFollowup } from '@/modules/followup';
import { detectarInativos } from '@/modules/followup';
import { executarCampanhas } from '@/modules/followup';

type CronResult = { task: string; clinicId: string; ok: boolean; data?: unknown; error?: string };

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * P1-FIX-CANON(2): runAction.ok só diz que o handler não lançou.
 * Deriva falha de negócio do payload retornado (contrato de lote):
 * {requested,succeeded,failed,skipped,errors[],status} — com tolerância aos
 * vocabulários legados (sent/notified/processed). Retorna a mensagem de erro
 * ou null quando o lote foi bem-sucedido (ou vazio sem falhas).
 */
function businessFailure(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.success === false) {
    if (Array.isArray(d.errors) && d.errors.length > 0) {
      return (d.errors as unknown[]).slice(0, 5).map(String).join('; ');
    }
    if (typeof d.error === 'string' && d.error) return d.error;
    return `business batch failed (status=${String(d.status ?? 'failed')})`;
  }
  const failed = num(d.failed);
  if (failed > 0 && d.success !== true) {
    const succeeded = num(d.succeeded) + num(d.sent) + num(d.notified);
    if (succeeded === 0) {
      if (Array.isArray(d.errors) && d.errors.length > 0) {
        return (d.errors as unknown[]).slice(0, 5).map(String).join('; ');
      }
      return `${failed} operation(s) failed without success`;
    }
  }
  return null;
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  // Verify CRON_SECRET before rate limit — invalid credentials must not consume scheduler quota (T1 DoS fix).
  const cronSecret = request.headers.get('Authorization') ?? '';
  const expectedSecret = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (
    !process.env.CRON_SECRET ||
    cronSecret.length !== expectedSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expectedSecret))
  ) {
    return apiFailure('UNAUTHORIZED', 'Unauthorized', requestId, 401);
  }

  const rateLimit = checkRateLimit('cron', {
    ...rateLimitPresets.cron,
    maxRequests: 30,
  });
  if (!rateLimit.allowed) {
    return apiRateLimited(requestId, rateLimit.retryAfter);
  }

  // Module gate — skip if followup module is not contracted
  try {
    await assertModuleForJob('followup', createManifest());
  } catch (_e) {
    return apiSuccess(
      { success: true, status: 'skipped', skipped: 'followup module disabled', timestamp: new Date().toISOString() },
    );
  }

  // Get query params to filter what to process
  const { searchParams } = new URL(request.url);
  const tasks = searchParams.get('tasks')?.split(',') || ['all'];

  const results: Record<string, CronResult[]> = {};
  let skipped = 0;

  // Select only active (non-deleted) clinics
  const db = getDb();
  const activeClinics = await db
    .select({ id: clinics.id })
    .from(clinics)
    .where(isNull(clinics.deletedAt));

  // Build the task → action mapping with required permission
  // P1-FIX-CANON(2): outputs heterogêneos (cada Action tem seu batch) —
  // ActionDefinition<any, unknown> evita colapso de inferência do union.
  const TASK_MAP: Array<{
    key: string;
    action: ActionDefinition<any, unknown>;
    requires: string;
  }> = [
    { key: 'followups', action: executarFollowup, requires: 'followup:manage_followups' },
    { key: 'inactivity', action: detectarInativos, requires: 'followup:manage_followups' },
    { key: 'campaigns', action: executarCampanhas, requires: 'followup:manage_campaigns' },
  ];

  for (const taskSpec of TASK_MAP) {
    if (!tasks.includes('all') && !tasks.includes(taskSpec.key)) continue;

    const taskResults: CronResult[] = [];

    for (const clinic of activeClinics) {
      const ctx = await buildCronContext(clinic.id);
      if (!ctx.can(taskSpec.requires)) {
        logger.info(`[cron/followups] Clinic ${clinic.id} lacks ${taskSpec.requires}, skipping ${taskSpec.key}`);
        skipped++;
        continue;
      }

      try {
        const result = await runAction(taskSpec.action, {}, ctx);
        if (result.ok) {
          // P1-FIX-CANON(2): agrega o resultado de negócio, não só runAction.ok.
          const failure = businessFailure(result.data);
          if (failure) {
            taskResults.push({ task: taskSpec.key, clinicId: clinic.id, ok: false, error: failure, data: result.data });
          } else {
            taskResults.push({ task: taskSpec.key, clinicId: clinic.id, ok: true, data: result.data });
          }
        } else {
          taskResults.push({ task: taskSpec.key, clinicId: clinic.id, ok: false, error: result.error.message });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        taskResults.push({ task: taskSpec.key, clinicId: clinic.id, ok: false, error: message });
      }
    }

    results[taskSpec.key] = taskResults;
  }

  // Check and notify hot leads across all clinics (existing preserved branch)
  // P1-FIX-CANON(3): o contexto cron padrão NÃO contém
  // 'comercial:manage_hot_leads' (allowlist fixa de follow-up) — executar a
  // Action com ele era sempre forbidden mas reportava ok:true. Usa contexto
  // explicitamente autorizado SÓ para essa permissão (sem ampliar a
  // allowlist global) e registra o resultado por clínica.
  if (tasks.includes('all') || tasks.includes('hot-leads')) {
    logger.info('[cron/followups] Checking hot leads across clinics...');
    const hotLeadsResults: CronResult[] = [];
    for (const c of activeClinics) {
      const base = await buildCronContext(c.id);
      if (!base.hasModule('comercial')) {
        logger.info(`[cron/followups] Clinic ${c.id} lacks comercial module, skipping hot-leads`);
        skipped++;
        continue;
      }
      const hotCtx = {
        ...base,
        can: (key: string) => key === 'comercial:manage_hot_leads',
        audit: { actor: 'cron:hot-leads' },
      };
      try {
        const actionResult = await runAction(processarNotificacoesLeadsQuentes, {}, hotCtx);
        if (!actionResult.ok) {
          hotLeadsResults.push({ task: 'hot-leads', clinicId: c.id, ok: false, error: actionResult.error.message });
        } else {
          const failure = businessFailure(actionResult.data);
          if (failure) {
            hotLeadsResults.push({ task: 'hot-leads', clinicId: c.id, ok: false, error: failure, data: actionResult.data });
          } else {
            hotLeadsResults.push({ task: 'hot-leads', clinicId: c.id, ok: true, data: actionResult.data });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        hotLeadsResults.push({ task: 'hot-leads', clinicId: c.id, ok: false, error: message });
      }
    }
    results.hotLeads = hotLeadsResults;
  }

  // Agregado explícito: nunca success:true puro quando há falhas registradas.
  const allEntries = Object.values(results).flat();
  const requested = allEntries.length;
  const failedEntries = allEntries.filter((r) => !r.ok);
  const succeeded = requested - failedEntries.length;
  const errors = failedEntries.map((r) => `${r.task}/${r.clinicId}: ${r.error ?? 'unknown error'}`);
  const failed = failedEntries.length;
  const success = failed === 0;
  const status = failed === 0 ? 'completed' : succeeded > 0 ? 'partial' : 'failed';

  return apiSuccess({
    success,
    status,
    timestamp: new Date().toISOString(),
    summary: { requested, succeeded, failed, skipped, errors },
    results,
  });
}

/**
 * GET /api/cron/followups — health check
 */
async function handleGET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    message: 'Follow-up cron endpoint is active',
    availableTasks: ['followups', 'inactivity', 'campaigns', 'hot-leads', 'all'],
    timestamp: new Date().toISOString(),
  });
}

export { handleGET as GET, handlePOST as POST };
