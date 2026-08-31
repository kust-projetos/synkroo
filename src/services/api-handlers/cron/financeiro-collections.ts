/**
 * POST /api/cron/financeiro-collections
 *
 * Daily collections job: finds overdue charges for every active clinic and
 * sends configured reminders. Tenant scope is enumerated server-side; the
 * request cannot select an arbitrary clinic through query parameters.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { assertModuleForJob } from "@/core/modules/gates";
import { createManifest } from '@/core/modules/manifest';
import { getDb } from "@/lib/db/client";
import { clinics } from "@/lib/db/schema/core";
import { isNull } from "drizzle-orm";
import {
  listOverdueCharges,
  enrichOverdueCharges,
  getCollectionStage,
  sendReminder,
} from "@/modules/financeiro/services/collection-service";

export async function POST(_request: NextRequest) {
  try {
    const cronSecret = _request.headers.get("Authorization") || "";
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

    if (
      !process.env.CRON_SECRET ||
      cronSecret.length !== expectedSecret.length ||
      !crypto.timingSafeEqual(
        Buffer.from(cronSecret),
        Buffer.from(expectedSecret),
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await assertModuleForJob("financeiro", createManifest());

    const db = getDb();
    const activeClinics = await db
      .select({ id: clinics.id })
      .from(clinics)
      .where(isNull(clinics.deletedAt));

    const results: Array<{
      clinicId: string;
      processed: number;
      remindersSent: number;
      charges: Array<{
        chargeId: string;
        stage: string;
        reminderSent: boolean;
      }>;
    }> = [];

    for (const clinic of activeClinics) {
      const overdue = await listOverdueCharges(clinic.id);
      const enriched = enrichOverdueCharges(overdue);
      const clinicResults: Array<{
        chargeId: string;
        stage: string;
        reminderSent: boolean;
      }> = [];

      for (const charge of enriched) {
        const stage = getCollectionStage(charge.daysOverdue);
        if (stage === "none") continue;

        const reminderResult = await sendReminder({
          clinicId: clinic.id,
          chargeId: charge.id,
        });
        clinicResults.push({
          chargeId: charge.id,
          stage,
          reminderSent: reminderResult.sent,
        });
      }

      results.push({
        clinicId: clinic.id,
        processed: enriched.length,
        remindersSent: clinicResults.filter((result) => result.reminderSent)
          .length,
        charges: clinicResults,
      });
    }

    return NextResponse.json({
      processed: results.reduce((total, result) => total + result.processed, 0),
      remindersSent: results.reduce(
        (total, result) => total + result.remindersSent,
        0,
      ),
      clinicsProcessed: results.length,
      results,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
