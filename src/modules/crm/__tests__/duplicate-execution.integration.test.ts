/**
 * Integration test: merge execution concurrency — proves CAS finalize exactly once.
 *
 * Precondition: RUN_INTEGRATION_TESTS=1, TEST_DATABASE_URL points to
 * local /synkroo_test database with migrations applied.
 *
 * Run via: npm run test:integration:run -- src/modules/crm/__tests__/duplicate-execution.integration.test.ts
 */

/** @jest-environment node */

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import { crmDuplicateSuggestions } from '@/lib/db/schema';
import {
  claimSuggestion,
  markSuggestionFailed,
  finalizeMergeAndDismissSiblings,
} from '@/modules/crm/repositories/merge-execution-repository';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const CLINIC_ID = '00000000-0000-0000-0000-00000000a001';
const OWNER_TYPE = 'patient';
const LEFT_ID = '00000000-0000-0000-0000-00000000b001';
const RIGHT_ID = '00000000-0000-0000-0000-00000000b002';
const SUGGESTION_ID = '00000000-0000-0000-0000-00000000c001';
const MERGE_OP_KEY_1 = 'merge-test-winner';
const MERGE_OP_KEY_2 = 'merge-test-loser';

describeOrSkip('Merge execution concurrency (DB real)', () => {
  beforeAll(async () => {
    const db = getDb();
    // Create clinic
    await db.execute(
      sql`INSERT INTO clinics (id, name, slug, phone, email)
          VALUES (${CLINIC_ID}, 'Merge Concurrency Test', 'merge-concurrency', '11999990001', 'merge@test.com')
          ON CONFLICT (id) DO NOTHING`,
    );
    // Create an approved suggestion.
    // winnerConfirmedId must be set to LEFT_ID (or RIGHT_ID) to satisfy the
    // crm_duplicate_suggestions_winner_check constraint when status moves to
    // 'executing' or 'merged'.
    await db.execute(
      sql`INSERT INTO crm_duplicate_suggestions (id, clinic_id, owner_type, left_id, right_id, status, confidence, duplicate_score, winner_confirmed_id, signals, left_snapshot, right_snapshot)
          VALUES (${SUGGESTION_ID}, ${CLINIC_ID}, ${OWNER_TYPE}, ${LEFT_ID}, ${RIGHT_ID}, 'approved', 'high', 85, ${LEFT_ID}, '{}'::jsonb, '{"id":"left"}'::jsonb, '{"id":"right"}'::jsonb)
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM crm_duplicate_suggestions WHERE id = ${SUGGESTION_ID}`);
    await db.execute(sql`DELETE FROM clinics WHERE id = ${CLINIC_ID}`);
    await closeDb();
  });

  // ── Winner finalize ────────────────────────────

  it('first finalizer wins and suggestion becomes merged', async () => {
    const db = getDb();

    // Claim
    await db.execute(
      sql`UPDATE crm_duplicate_suggestions
          SET status = 'executing', merge_operation_key = ${MERGE_OP_KEY_1}, executed_at = now(), updated_at = now()
          WHERE id = ${SUGGESTION_ID} AND status = 'approved'`,
    );

    // Finalize (CAS on id + mergeOperationKey + status='executing')
    const finalizeResult: any = await db.execute(
      sql`UPDATE crm_duplicate_suggestions
          SET status = 'merged', updated_at = now()
          WHERE id = ${SUGGESTION_ID} AND merge_operation_key = ${MERGE_OP_KEY_1} AND status = 'executing'`,
    );

    expect(finalizeResult.rowCount).toBe(1);

    // Verify status is now 'merged'
    const [row] = await db
      .select({ status: crmDuplicateSuggestions.status })
      .from(crmDuplicateSuggestions)
      .where(sql`id = ${SUGGESTION_ID}`)
      .limit(1);

    expect(row.status).toBe('merged');
  });

  // ── Loser rereads merged ─────────────────────────

  it('loser reads merged and does not attempt finalize', async () => {
    const db = getDb();

    // Reread the suggestion — status is now 'merged'
    const [row] = await db
      .select({ status: crmDuplicateSuggestions.status, mergeOperationKey: crmDuplicateSuggestions.mergeOperationKey })
      .from(crmDuplicateSuggestions)
      .where(sql`id = ${SUGGESTION_ID}`)
      .limit(1);

    expect(row.status).toBe('merged');
    expect(row.mergeOperationKey).toBe(MERGE_OP_KEY_1); // winner's key
  });

  // ── Loser CAS attempt returns conflict ───────────

  it('loser CAS attempt with stale operation key finds no matching row', async () => {
    const db = getDb();

    // Attempt CAS finalize with wrong operation key
    const staleResult: any = await db.execute(
      sql`UPDATE crm_duplicate_suggestions
          SET status = 'merged', updated_at = now()
          WHERE id = ${SUGGESTION_ID} AND merge_operation_key = ${MERGE_OP_KEY_2} AND status = 'executing'`,
    );

    expect(staleResult.rowCount).toBe(0);

    // Suggestion still has winner's status and key
    const [row] = await db
      .select({ status: crmDuplicateSuggestions.status, mergeOperationKey: crmDuplicateSuggestions.mergeOperationKey })
      .from(crmDuplicateSuggestions)
      .where(sql`id = ${SUGGESTION_ID}`)
      .limit(1);

    expect(row.status).toBe('merged');
  });

  // ── Non-final conflict ──────────────────────────

  it('second claim attempt for same suggestion returns conflict (CAS miss)', async () => {
    const db = getDb();

    // Another process tries to claim from 'approved' — but it's already 'merged'
    const claimResult: any = await db.execute(
      sql`UPDATE crm_duplicate_suggestions
          SET status = 'executing', merge_operation_key = ${MERGE_OP_KEY_2}, executed_at = now(), updated_at = now()
          WHERE id = ${SUGGESTION_ID} AND status = 'approved'`,
    );

    // CAS miss — 0 rows updated because status is 'merged', not 'approved'
    expect(claimResult.rowCount).toBe(0);
  });
});

describeOrSkip('Merge execution repository functions (DB real)', () => {
  const SUGGESTION_2 = '00000000-0000-0000-0000-00000000c002';
  const KEY_1 = 'merge-repo-winner';
  const KEY_2 = 'merge-repo-loser';
  const LEFT = LEFT_ID;
  const RIGHT = RIGHT_ID;
  const FOREIGN_CLINIC = '00000000-0000-0000-0000-00000000ffff';

  async function resetToApproved() {
    const db = getDb();
    await db.execute(
      sql`UPDATE crm_duplicate_suggestions
          SET status = 'approved', merge_operation_key = NULL, executed_at = NULL,
              failure_reason = NULL, updated_at = now()
          WHERE id = ${SUGGESTION_2}`,
    );
  }

  beforeAll(async () => {
    const db = getDb();
    await db.execute(
      sql`INSERT INTO clinics (id, name, slug, phone, email)
          VALUES (${CLINIC_ID}, 'Merge Repo Test', 'merge-repo', '11999990001', 'mergerepo@test.com')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO crm_duplicate_suggestions (id, clinic_id, owner_type, left_id, right_id, status, confidence, duplicate_score, winner_confirmed_id, signals, left_snapshot, right_snapshot)
          VALUES (${SUGGESTION_2}, ${CLINIC_ID}, ${OWNER_TYPE}, ${LEFT}, ${RIGHT}, 'approved', 'high', 85, ${LEFT}, '{}'::jsonb, '{"id":"left"}'::jsonb, '{"id":"right"}'::jsonb)
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM crm_duplicate_suggestions WHERE id = ${SUGGESTION_2}`);
    await db.execute(sql`DELETE FROM clinics WHERE id = ${CLINIC_ID}`);
  });

  it('claimSuggestion claims an approved suggestion via CAS', async () => {
    const db = getDb();
    await resetToApproved();
    const ok = await claimSuggestion(SUGGESTION_2, CLINIC_ID, KEY_1, undefined);
    expect(ok).toBe(true);

    const [row] = await db
      .select({ status: crmDuplicateSuggestions.status })
      .from(crmDuplicateSuggestions)
      .where(sql`id = ${SUGGESTION_2}`)
      .limit(1);
    expect(row.status).toBe('executing');
  });

  it('claimSuggestion returns false for a foreign clinic', async () => {
    await resetToApproved();
    const ok = await claimSuggestion(SUGGESTION_2, FOREIGN_CLINIC, KEY_1, undefined);
    expect(ok).toBe(false);
  });

  it('claimSuggestion coerces undefined executedBy to null', async () => {
    const db = getDb();
    await resetToApproved();
    const ok = await claimSuggestion(SUGGESTION_2, CLINIC_ID, KEY_1, undefined);
    expect(ok).toBe(true);
    const [row] = await db
      .select({ status: crmDuplicateSuggestions.status, executedBy: crmDuplicateSuggestions.executedBy })
      .from(crmDuplicateSuggestions)
      .where(sql`id = ${SUGGESTION_2}`)
      .limit(1);
    expect(row.status).toBe('executing');
    expect(row.executedBy).toBeNull();
  });

  it('markSuggestionFailed marks an executing suggestion via CAS', async () => {
    await resetToApproved();
    await claimSuggestion(SUGGESTION_2, CLINIC_ID, KEY_1, undefined);
    const ok = await markSuggestionFailed(SUGGESTION_2, CLINIC_ID, KEY_1, 'owner_merge_failed');
    expect(ok).toBe(true);

    const bad = await markSuggestionFailed(SUGGESTION_2, CLINIC_ID, KEY_2, 'owner_merge_failed');
    expect(bad).toBe(false);
  });

  it('markSuggestionFailed with foreign clinicId returns false and preserves state', async () => {
    const db = getDb();
    await resetToApproved();
    await claimSuggestion(SUGGESTION_2, CLINIC_ID, KEY_1, undefined);

    const bad = await markSuggestionFailed(SUGGESTION_2, FOREIGN_CLINIC, KEY_1, 'cross_clinic_attempt');
    expect(bad).toBe(false);

    // State unchanged — still 'executing'
    const [row] = await db
      .select({ status: crmDuplicateSuggestions.status })
      .from(crmDuplicateSuggestions)
      .where(sql`id = ${SUGGESTION_2}`)
      .limit(1);
    expect(row.status).toBe('executing');
  });

  it('finalizeMergeAndDismissSiblings with foreign clinicId returns false and preserves state', async () => {
    const db = getDb();
    await resetToApproved();
    await claimSuggestion(SUGGESTION_2, CLINIC_ID, KEY_1, undefined);

    const bad = await finalizeMergeAndDismissSiblings(SUGGESTION_2, KEY_1, FOREIGN_CLINIC, LEFT, RIGHT, OWNER_TYPE);
    expect(bad).toBe(false);

    // State unchanged — still 'executing'
    const [row] = await db
      .select({ status: crmDuplicateSuggestions.status })
      .from(crmDuplicateSuggestions)
      .where(sql`id = ${SUGGESTION_2}`)
      .limit(1);
    expect(row.status).toBe('executing');
  });

  it('finalizeMergeAndDismissSiblings finalizes winner via CAS', async () => {
    const db = getDb();
    await resetToApproved();
    await claimSuggestion(SUGGESTION_2, CLINIC_ID, KEY_1, undefined);
    const ok = await finalizeMergeAndDismissSiblings(SUGGESTION_2, KEY_1, CLINIC_ID, LEFT, RIGHT, OWNER_TYPE);
    expect(ok).toBe(true);

    const [row] = await db
      .select({ status: crmDuplicateSuggestions.status })
      .from(crmDuplicateSuggestions)
      .where(sql`id = ${SUGGESTION_2}`)
      .limit(1);
    expect(row.status).toBe('merged');

    // Wrong operation key → CAS miss → false
    const bad = await finalizeMergeAndDismissSiblings(SUGGESTION_2, KEY_2, CLINIC_ID, LEFT, RIGHT, OWNER_TYPE);
    expect(bad).toBe(false);
  });

  it('winner_confirmed_id outsider UUID rejected by CHECK constraint', async () => {
    const db = getDb();
    // Use a UUID that is NEITHER left_id NOR right_id
    const OUTSIDER_ID = '00000000-0000-0000-0000-00000000ffff';

    // Reset to approved state first
    await resetToApproved();

    // Attempt to set winner_confirmed_id to an outsider UUID — must be rejected
    // by crm_duplicate_suggestions_winner_member_check constraint
    await expect(
      db.execute(sql`
        UPDATE crm_duplicate_suggestions
        SET winner_confirmed_id = ${OUTSIDER_ID}, updated_at = now()
        WHERE id = ${SUGGESTION_2}
      `),
    ).rejects.toThrow();

    // After failed attempt, row should still have original winner_confirmed_id
    await resetToApproved();
  });
});
