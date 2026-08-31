/**
 * merge-execution-repository.ts — Focused repository for merge finalization.
 *
 * Owns claim, failure, and atomic finalize+dismiss operations.
 * All CAS predicates use id + status + mergeOperationKey.
 */

import { eq, and, inArray, ne, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { crmDuplicateSuggestions } from '@/modules/crm/schema/duplicates';

/**
 * Claim a suggestion for execution via CAS.
 * Transitions from 'approved' → 'executing' only if id + clinicId + status match.
 * Sets mergeOperationKey and executedAt.
 * Returns true if the claim succeeded (1 row updated).
 */
export async function claimSuggestion(
  id: string,
  clinicId: string,
  mergeOperationKey: string,
  executedBy: string | undefined,
): Promise<boolean> {
  const db = getDb();
  const result: any = await db
    .update(crmDuplicateSuggestions)
    .set({
      status: 'executing',
      mergeOperationKey,
      executedBy: executedBy ?? null,
      executedAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .where(and(
      eq(crmDuplicateSuggestions.id, id),
      eq(crmDuplicateSuggestions.clinicId, clinicId),
      eq(crmDuplicateSuggestions.status, 'approved'),
    ));
  return (result?.rowCount ?? 0) > 0;
}

/**
 * Mark a claimed suggestion as failed via CAS.
 * Transitions from 'executing' → 'failed' only if id + clinicId +
 * mergeOperationKey match.
 * Returns true if the update succeeded (1 row updated).
 */
export async function markSuggestionFailed(
  id: string,
  clinicId: string,
  mergeOperationKey: string,
  failureReason: string,
): Promise<boolean> {
  const db = getDb();
  const result: any = await db
    .update(crmDuplicateSuggestions)
    .set({
      status: 'failed',
      failureReason,
      updatedAt: new Date(),
    } as any)
    .where(and(
      eq(crmDuplicateSuggestions.id, id),
      eq(crmDuplicateSuggestions.clinicId, clinicId),
      eq(crmDuplicateSuggestions.mergeOperationKey, mergeOperationKey),
      eq(crmDuplicateSuggestions.status, 'executing'),
    ));
  return (result?.rowCount ?? 0) > 0;
}

/**
 * Finalize a merge AND dismiss siblings in ONE transaction.
 * Winner: transition from 'executing' → 'merged'.
 * Siblings: transition 'pending'/'approved' → 'dismissed' with reason 'stale_after_merge'.
 *
 * Both operations use CAS predicates. Returns true if winner was finalized.
 * If the winner CAS fails (another finalizer already merged), the entire
 * transaction rolls back and returns false.
 */
export async function finalizeMergeAndDismissSiblings(
  id: string,
  mergeOperationKey: string,
  clinicId: string,
  winnerId: string,
  loserId: string,
  ownerType: string,
): Promise<boolean> {
  const db = getDb();

  return db.transaction(async (tx) => {
    // CASE 1: Finalize the winning suggestion (CAS: id + clinicId + key + executing)
    const finalizeResult: any = await tx
      .update(crmDuplicateSuggestions)
      .set({ status: 'merged', updatedAt: new Date() } as any)
      .where(and(
        eq(crmDuplicateSuggestions.id, id),
        eq(crmDuplicateSuggestions.clinicId, clinicId),
        eq(crmDuplicateSuggestions.mergeOperationKey, mergeOperationKey),
        eq(crmDuplicateSuggestions.status, 'executing'),
      ));

    const finalized = (finalizeResult?.rowCount ?? 0) > 0;
    if (!finalized) {
      // CAS failed — another finalizer already merged or operation key mismatch
      return false;
    }

    // CASE 2: Dismiss sibling suggestions referencing winner or loser
    await tx
      .update(crmDuplicateSuggestions)
      .set({
        status: 'dismissed',
        dismissReason: 'stale_after_merge',
        updatedAt: new Date(),
      } as any)
      .where(and(
        eq(crmDuplicateSuggestions.clinicId, clinicId),
        eq(crmDuplicateSuggestions.ownerType, ownerType as any),
        ne(crmDuplicateSuggestions.id, id),
        sql`(${crmDuplicateSuggestions.leftId} = ${winnerId} OR ${crmDuplicateSuggestions.rightId} = ${winnerId})`,
        inArray(crmDuplicateSuggestions.status, ['pending', 'approved'] as any),
      ));

    // Also dismiss siblings referencing the loser
    await tx
      .update(crmDuplicateSuggestions)
      .set({
        status: 'dismissed',
        dismissReason: 'stale_after_merge',
        updatedAt: new Date(),
      } as any)
      .where(and(
        eq(crmDuplicateSuggestions.clinicId, clinicId),
        eq(crmDuplicateSuggestions.ownerType, ownerType as any),
        ne(crmDuplicateSuggestions.id, id),
        sql`(${crmDuplicateSuggestions.leftId} = ${loserId} OR ${crmDuplicateSuggestions.rightId} = ${loserId})`,
        inArray(crmDuplicateSuggestions.status, ['pending', 'approved'] as any),
      ));

    return true;
  });
}
