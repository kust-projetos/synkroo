/**
 * patient-merge-state-service.ts — Checks if a patient has already been merged.
 *
 * Used by recovery/race logic to detect merged patients before retry.
 * No dispatcher dependency.
 */

import { eq, and, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { crmDuplicateSuggestions } from '@/lib/db/schema';

/**
 * Check whether a patient has been merged (has a 'merged' suggestion referencing it).
 * Returns true if a merged suggestion exists where patientId is leftId or rightId.
 */
export async function isPatientMerged(
  patientId: string,
  clinicId: string,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: crmDuplicateSuggestions.id })
    .from(crmDuplicateSuggestions)
    .where(and(
      eq(crmDuplicateSuggestions.clinicId, clinicId),
      eq(crmDuplicateSuggestions.ownerType, 'patient'),
      eq(crmDuplicateSuggestions.status, 'merged'),
      or(
        eq(crmDuplicateSuggestions.leftId, patientId),
        eq(crmDuplicateSuggestions.rightId, patientId),
      ),
    ))
    .limit(1);
  return !!row;
}
