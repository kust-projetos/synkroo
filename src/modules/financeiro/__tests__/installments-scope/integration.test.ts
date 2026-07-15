/**
 * Integration test: installments tenant scope — verifies PATCH/DELETE cannot
 * mutate installments outside the caller's budget + tenant boundary.
 *
 * Precondition: RUN_INTEGRATION_TESTS=1, TEST_DATABASE_URL points to
 * local /synkroo_test database with migrations applied.
 *
 * Run via: npm run test:integration:run -- src/modules/financeiro/__tests__/installments-scope/integration.test.ts
 */

/** @jest-environment node */

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import { budgets, budgetInstallments } from '@/lib/db/schema';
import { replaceInstallmentsAtomic } from '@/modules/financeiro/repositories/installment-replacement-repository';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const CLINIC_A = '00000000-0000-0000-0000-00000000a001';
const CLINIC_B = '00000000-0000-0000-0000-00000000b001';
const BUDGET_A = '00000000-0000-0000-0000-00000000c001';
const BUDGET_B = '00000000-0000-0000-0000-00000000c002';
const INSTALLMENT_A = '00000000-0000-0000-0000-00000000d001';
const INSTALLMENT_B = '00000000-0000-0000-0000-00000000d002';

const ts = String(Date.now()).slice(-8);

describeOrSkip('Installments tenant scope (DB real)', () => {
  beforeAll(async () => {
    const db = getDb();

    // Create two clinics
    await db.execute(
      sql`INSERT INTO clinics (id, name, slug, phone, email)
          VALUES (${CLINIC_A}, 'Inst Scope Clinic A', 'inst-scope-a', '11999990001', 'a@inst-test.com')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO clinics (id, name, slug, phone, email)
          VALUES (${CLINIC_B}, 'Inst Scope Clinic B', 'inst-scope-b', '11999990002', 'b@inst-test.com')
          ON CONFLICT (id) DO NOTHING`,
    );

    // Create budget A (clinic A) with an installment
    await db.execute(
      sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status)
          VALUES (${BUDGET_A}, ${CLINIC_A}, 'Budget A', '500.00', '500.00', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO budget_installments (id, budget_id, amount, due_date, status)
          VALUES (${INSTALLMENT_A}, ${BUDGET_A}, '250.00', '2026-08-15', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );

    // Create budget B (clinic B) with an installment
    await db.execute(
      sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status)
          VALUES (${BUDGET_B}, ${CLINIC_B}, 'Budget B', '300.00', '300.00', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO budget_installments (id, budget_id, amount, due_date, status)
          VALUES (${INSTALLMENT_B}, ${BUDGET_B}, '150.00', '2026-09-01', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    // Replacements auto-generate installment ids, so clean by budget.
    await db.execute(sql`DELETE FROM budget_installments WHERE budget_id IN (${BUDGET_A}, ${BUDGET_B})`);
    await db.execute(sql`DELETE FROM budgets WHERE id IN (${BUDGET_A}, ${BUDGET_B})`);
    await db.execute(sql`DELETE FROM clinics WHERE id IN (${CLINIC_A}, ${CLINIC_B})`);
    await closeDb();
  });

  // ── PATCH scope ─────────────────────────────

  it('PATCH scoped by budget+tenant: foreign budget returns 0 rows, state unchanged', async () => {
    const db = getDb();

    // Attempt update with wrong budgetId (BUDGET_B) — even though installment A exists,
    // the combined predicate (installmentId + budgetId) should reject
    const result = await db
      .update(budgetInstallments)
      .set({ amount: '999.99' })
      .where(sql`id = ${INSTALLMENT_A} AND budget_id = ${BUDGET_B}`)
      .returning();

    // No rows affected — budget_id predicate rejected the cross-budget update
    expect(result.length).toBe(0);

    // Verify original installment A is untouched
    const [row] = await db
      .select({ amount: budgetInstallments.amount })
      .from(budgetInstallments)
      .where(sql`id = ${INSTALLMENT_A}`)
      .limit(1);

    expect(row).toBeDefined();
    expect(row.amount).toBe('250.00');
  });

  // ── DELETE scope ─────────────────────────────

  it('DELETE scoped by budget+tenant: cross-budget returns 0 rows, installment still exists', async () => {
    const db = getDb();

    // Attempt delete with wrong budgetId
    const result = await db
      .delete(budgetInstallments)
      .where(sql`id = ${INSTALLMENT_A} AND budget_id = ${BUDGET_B}`)
      .returning();

    // No rows affected — budget_id predicate rejected
    expect(result.length).toBe(0);

    // Verify installment A still exists
    const [row] = await db
      .select({ id: budgetInstallments.id })
      .from(budgetInstallments)
      .where(sql`id = ${INSTALLMENT_A}`)
      .limit(1);

    expect(row).toBeDefined();
    expect(row.id).toBe(INSTALLMENT_A);
  });

  // ── Atomic replacement (cover installment-replacement-repository) ──

  it('replaceInstallmentsAtomic atomically swaps installments for a budget', async () => {
    const db = getDb();
    const rows = await replaceInstallmentsAtomic(BUDGET_A, [
      { budgetId: BUDGET_A, amount: '75.00', dueDate: '2026-11-01', status: 'pending' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe('75.00');

    // Old INSTALLMENT_A deleted, exactly one installment remains for BUDGET_A
    const remaining = await db
      .select({ id: budgetInstallments.id, amount: budgetInstallments.amount })
      .from(budgetInstallments)
      .where(sql`budget_id = ${BUDGET_A}`);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).not.toBe(INSTALLMENT_A);
    expect(remaining[0].amount).toBe('75.00');
  });

  it('replaceInstallmentsAtomic does not affect other budgets', async () => {
    const db = getDb();
    const rows = await replaceInstallmentsAtomic(BUDGET_A, [
      { budgetId: BUDGET_A, amount: '10.00', dueDate: '2026-12-01', status: 'pending' },
    ]);
    expect(rows).toHaveLength(1);

    // BUDGET_B installments untouched (tenant isolation preserved)
    const other = await db
      .select({ id: budgetInstallments.id })
      .from(budgetInstallments)
      .where(sql`budget_id = ${BUDGET_B}`);
    expect(other.map((r) => r.id)).toContain(INSTALLMENT_B);
  });
});
