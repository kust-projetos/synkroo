/**
 * POST /api/cron/followups
 * Cron job endpoint to process follow-ups, inactivity detection, and campaigns.
 *
 * Recommended schedule:
 * - Every 5 minutes for post-consultation follow-ups
 * - Daily at 8am for return reminders
 * - Daily at 6am for inactivity detection
 * - Every 30 minutes for scheduled campaigns
 *
 * Security: CRON_SECRET Bearer token + module gate (skips if followup disabled).
 * Service layer called directly (not action layer — cron has no user session).
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { executarAll, runInactivityForCron, runCampaignsForCron } from '@/modules/followup/services/followup-service';
import { checkAllClinicsHotLeads } from '@/services/leads/lead-notification.service';
import { assertModuleForJob } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit';

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  // Rate limit cron endpoints
  const rateLimit = checkRateLimit('cron', {
    ...rateLimitPresets.cron,
    maxRequests: 30,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
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

  // Module gate — skip if followup module is not contracted
  try {
    await assertModuleForJob('followup', moduleManifest);
  } catch {
    return NextResponse.json(
      { success: true, skipped: 'followup module disabled', timestamp: new Date().toISOString() },
      { status: 200 },
    );
  }

  // Get query params to filter what to process
  const { searchParams } = new URL(request.url);
  const tasks = searchParams.get('tasks')?.split(',') || ['all'];

  const results: Record<string, unknown> = {};

  // Process follow-ups (post-consultation, return reminders)
  if (tasks.includes('all') || tasks.includes('followups')) {
    console.warn('[cron/followups] Processing follow-ups...');
    await executarAll();
    results.followUps = 'processed';
  }

  // Run inactivity detection
  if (tasks.includes('all') || tasks.includes('inactivity')) {
    console.warn('[cron/followups] Running inactivity detection...');
    await runInactivityForCron();
    results.inactivity = 'completed';
  }

  // Process scheduled campaigns
  if (tasks.includes('all') || tasks.includes('campaigns')) {
    console.warn('[cron/followups] Processing scheduled campaigns...');
    await runCampaignsForCron();
    results.campaigns = 'processed';
  }

  // Check and notify hot leads across all clinics
  if (tasks.includes('all') || tasks.includes('hot-leads')) {
    console.warn('[cron/followups] Checking hot leads across clinics...');
    await checkAllClinicsHotLeads();
    results.hotLeads = 'checked';
  }

  return NextResponse.json({
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
