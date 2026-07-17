/**
 * POST /api/cron/financeiro-collections
 *
 * Daily collections job: finds overdue charges and sends configured reminders.
 * - Validates CRON_SECRET via timing-safe comparison.
 * - Asserts Financeiro module is enabled via assertModuleForJob.
 * - Processes overdue charges with the D+1/D+3/D+7 collection stage régua.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { assertModuleForJob } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import {
  listOverdueCharges,
  enrichOverdueCharges,
  getCollectionStage,
  sendReminder,
} from '@/modules/financeiro/services/collection-service';

export async function POST(request: NextRequest) {
  try {
    // 1. Validate CRON_SECRET
    const cronSecret = request.headers.get('Authorization') || '';
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

    if (
      !process.env.CRON_SECRET ||
      cronSecret.length !== expectedSecret.length ||
      !crypto.timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expectedSecret))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Assert financeiro module is enabled
    await assertModuleForJob('financeiro', moduleManifest);

    // 3. Get the clinic context (from query param or default)
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get('clinicId');

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId query parameter is required' }, { status: 400 });
    }

    // 4. Find overdue charges
    const overdue = await listOverdueCharges(clinicId);
    const enriched = enrichOverdueCharges(overdue);

    // 5. Process collection stage reminders
    const results: Array<{ chargeId: string; stage: string; reminderSent: boolean }> = [];

    for (const charge of enriched) {
      const stage = getCollectionStage(charge.daysOverdue);

      // Only send reminders for light/firm/internal stages
      if (stage !== 'none') {
        const reminderResult = await sendReminder({
          clinicId,
          chargeId: charge.id,
        });

        results.push({
          chargeId: charge.id,
          stage,
          reminderSent: reminderResult.sent,
        });
      }
    }

    return NextResponse.json({
      processed: enriched.length,
      remindersSent: results.filter(r => r.reminderSent).length,
      results,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
