/**
 * merge-state-service.ts — Checks if a lead has already been merged.
 *
 * Used by recovery/race logic to detect merged leads before retry.
 * No dispatcher dependency.
 */

import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { leads } from '@/modules/comercial/schema/leads';

/**
 * Check the owner record directly. The CRM suggestion is not the source of
 * truth for the lead merge state.
 */
export async function isLeadMerged(
  leadId: string,
  clinicId: string,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(
      eq(leads.clinicId, clinicId),
      eq(leads.id, leadId),
      sql`${leads.mergeStatus} = 'merged'`,
    ))
    .limit(1);
  return !!row;
}
