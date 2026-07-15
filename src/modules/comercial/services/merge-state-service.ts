/**
 * merge-state-service.ts — Checks if a lead has already been merged.
 *
 * Used by recovery/race logic to detect merged leads before retry.
 * No dispatcher dependency.
 */

import { eq, and, or } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { crmDuplicateSuggestions } from '@/lib/db/schema';

/**
 * Check whether a lead has been merged (has a 'merged' suggestion referencing it).
 * Returns true if a merged suggestion exists where leadId is leftId or rightId.
 */
export async function isLeadMerged(
  leadId: string,
  clinicId: string,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: crmDuplicateSuggestions.id })
    .from(crmDuplicateSuggestions)
    .where(and(
      eq(crmDuplicateSuggestions.clinicId, clinicId),
      eq(crmDuplicateSuggestions.ownerType, 'lead'),
      eq(crmDuplicateSuggestions.status, 'merged'),
      or(
        eq(crmDuplicateSuggestions.leftId, leadId),
        eq(crmDuplicateSuggestions.rightId, leadId),
      ),
    ))
    .limit(1);
  return !!row;
}
