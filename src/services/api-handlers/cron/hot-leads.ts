/**
 * POST /api/cron/hot-leads
 * Cron job to process hot lead notifications across all clinics.
 *
 * Security: CRON_SECRET Bearer token + module gate.
 * Uses system context to run comercial.processarNotificacoesLeadsQuentes.
 *
 * Schedule: every 5 minutes (configured in manifest.ts job entry).
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { assertModuleForJob } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { processarNotificacoesLeadsQuentes } from '@/modules/comercial';
import { runAction } from '@/core/actions/run';
import { getDb } from '@/lib/db/client';
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit';
import { clinics } from '@/lib/db/schema/core';
import { isNull } from 'drizzle-orm';
import { apiSuccess, apiFailure, apiRateLimited, generateRequestId } from '@/lib/api/response';

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  // Verify CRON_SECRET
  const cronSecret = request.headers.get('Authorization') ?? '';
  const expectedSecret = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (
    !process.env.CRON_SECRET ||
    cronSecret.length !== expectedSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expectedSecret))
  ) {
    return apiFailure('UNAUTHORIZED', 'Unauthorized', requestId, 401);
  }

  // Module gate — skip if comercial module is not contracted
  try {
    await assertModuleForJob('comercial', createManifest());
  } catch {
    return apiSuccess(
      { success: true, skipped: 'comercial module disabled', timestamp: new Date().toISOString() },
    );
  }

  // Auth-before-limiter (padrão cleanup.ts): credencial inválida e módulo
  // desabilitado não consomem quota do scheduler.
  const rateLimit = checkRateLimit('cron', rateLimitPresets.cron);
  if (!rateLimit.allowed) {
    return apiRateLimited(requestId, rateLimit.retryAfter);
  }

  // Resolve all clinics and process hot leads for each
  const allClinics = await getDb()
    .select({ id: clinics.id })
    .from(clinics)
    .where(isNull(clinics.deletedAt));

  let totalNotified = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const clinic of allClinics) {
    try {
      const ctx = {
        source: 'system' as const,
        clinicId: clinic.id,
        can: () => true,
        hasModule: () => true,
        audit: { actor: 'cron' },
      };
      const result = await runAction(processarNotificacoesLeadsQuentes, {}, ctx);
      if (result.ok) {
        totalNotified += (result.data as { notified?: number }).notified ?? 0;
        totalSkipped += (result.data as { skipped?: number }).skipped ?? 0;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Clinic ${clinic.id}: ${msg}`);
    }
  }

  return apiSuccess({
    success: true,
    timestamp: new Date().toISOString(),
    results: {
      clinics_processed: allClinics.length,
      total_notified: totalNotified,
      total_skipped: totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
    },
  });
}

// Health check
async function handleGET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    message: 'Hot-leads cron endpoint is active',
    timestamp: new Date().toISOString(),
  });
}

export { handleGET as GET, handlePOST as POST };
