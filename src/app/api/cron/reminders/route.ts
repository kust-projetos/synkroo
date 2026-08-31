/**
 * POST /api/cron/reminders — process appointment reminders (cron)
 * GET  /api/cron/reminders — health check
 *
 * Security: CRON_SECRET Bearer token verification.
 * Module gate: skips processing if operacional module is disabled (returns 200 with skipped).
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processAllReminders } from '@/modules/operacional/services/reminders-service';
import { assertModuleForJob } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit';

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const rateLimit = checkRateLimit('cron', rateLimitPresets.cron);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

  // Verify CRON_SECRET
  const cronSecret = request.headers.get('Authorization') ?? '';
  const expectedSecret = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (
    !process.env.CRON_SECRET ||
    cronSecret.length !== expectedSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expectedSecret))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Module gate — skip if disabled (200, not error)
  try {
    await assertModuleForJob('operacional', createManifest());
  } catch {
    return NextResponse.json(
      { success: true, skipped: 'operacional module disabled', timestamp: new Date().toISOString() },
      { status: 200 },
    );
  }

  const result = await processAllReminders();
  return NextResponse.json({
    success: true,
    processed: result.processed,
    errors: result.errors,
    timestamp: new Date().toISOString(),
  });
}

async function handleGET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    message: 'Reminder cron endpoint is active',
    timestamp: new Date().toISOString(),
  });
}

export { handleGET as GET, handlePOST as POST };
