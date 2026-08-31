/**
 * patient-merge-state-service.ts — Checks if a patient has already been merged.
 *
 * Used by recovery/race logic to detect merged patients before retry.
 * No dispatcher dependency.
 */

import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { patients } from '@/modules/operacional/schema/patients';

/**
 * Check the owner record directly. The CRM suggestion is not the source of
 * truth for the patient merge state.
 */
export async function isPatientMerged(
  patientId: string,
  clinicId: string,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(
      eq(patients.clinicId, clinicId),
      eq(patients.id, patientId),
      sql`${patients.mergeStatus} = 'merged'`,
    ))
    .limit(1);
  return !!row;
}
