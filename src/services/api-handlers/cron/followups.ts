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
    return apiRateLimited(requestId, rateLimit.retryAfter ?? 0);
  }

  // Module gate — skip if followup module is not contracted
  try {
    await assertModuleForJob('followup', createManifest());
  } catch (_e) {
    return apiSuccess(
      { success: true, skipped: 'followup module disabled', timestamp: new Date().toISOString() },
    );
  }

  // Get query params to filter what to process
  const { searchParams } = new URL(request.url);
  const tasks = searchParams.get('tasks')?.split(',') || ['all'];

  const results: Record<string, CronResult[]> = {};

  // Select only active (non-deleted) clinics
  const db = getDb();
  const activeClinics = await db
    .select({ id: clinics.id })
    .from(clinics)
    .where(isNull(clinics.deletedAt));

  // Build the task → action mapping with required permission
  const TASK_MAP: Array<{
    key: string;
    action: typeof executarFollowup | typeof detectarInativos | typeof executarCampanhas;
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
        continue;
      }

      try {
        const result = await runAction(taskSpec.action, {}, ctx);
        if (result.ok) {
          taskResults.push({ task: taskSpec.key, clinicId: clinic.id, ok: true, data: result.data });
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
  if (tasks.includes('all') || tasks.includes('hot-leads')) {
    logger.info('[cron/followups] Checking hot leads across clinics...');
    try {
      for (const c of activeClinics) {
        const ctx = await buildCronContext(c.id);
        await runAction(processarNotificacoesLeadsQuentes, {}, ctx);
      }
      results.hotLeads = [{ task: 'hot-leads', clinicId: 'all', ok: true }];
    } catch (err) {
      logger.error('[cron/followups] Hot leads processing error:', err);
      results.hotLeads = [{ task: 'hot-leads', clinicId: 'all', ok: false, error: String(err) }];
    }
  }

  return apiSuccess({
    success: true,
    timestamp: new Date().toISOString(),
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
