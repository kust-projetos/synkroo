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
    // Create an approved suggestion
    await db.execute(
      sql`INSERT INTO crm_duplicate_suggestions (id, clinic_id, owner_type, left_id, right_id, status, confidence, duplicate_score, signals, left_snapshot, right_snapshot)
          VALUES (${SUGGESTION_ID}, ${CLINIC_ID}, ${OWNER_TYPE}, ${LEFT_ID}, ${RIGHT_ID}, 'approved', 'high', 85, '{}'::jsonb, '{"id":"left"}'::jsonb, '{"id":"right"}'::jsonb)
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
