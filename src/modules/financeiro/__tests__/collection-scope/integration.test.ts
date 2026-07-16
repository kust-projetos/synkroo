/**
 * Integration test: collection charge tenant scope — verifies sendReminder
 * scoped charge lookup prevents cross-tenant leaks.
 *
 * Precondition: RUN_INTEGRATION_TESTS=1, TEST_DATABASE_URL points to
 * local /synkroo_test database with migrations applied.
 *
 * Run via: npm run test:integration:run -- src/modules/financeiro/__tests__/collection-scope/integration.test.ts
 */

/** @jest-environment node */

import { sql, eq } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import {
  getBudgetForClinic,
  updateInstallmentForBudget,
  deleteInstallmentForBudget,
  getPaymentChargeForClinic,
} from '@/modules/financeiro/repositories/financeiro-scope-repository';
import { sendReminder } from '@/modules/financeiro/services/collection-service';
import { buildSystemContext } from '@/core/actions/context';
import { enviarLembreteCobranca } from '@/modules/financeiro/actions/enviar-lembrete-cobranca';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const CLINIC_A = '00000000-0000-0000-0000-00000000a001';
const CLINIC_B = '00000000-0000-0000-0000-00000000b001';
const BUDGET_A = '00000000-0000-0000-0000-00000000c001';
const BUDGET_B = '00000000-0000-0000-0000-00000000c002';
const CHARGE_A = '00000000-0000-0000-0000-00000000d001';
const GATEWAY_A = '00000000-0000-0000-0000-00000000f001';
const PATIENT_A = '00000000-0000-0000-0000-00000000e001';
const INSTALLMENT_A = '00000000-0000-0000-0000-00000000d002';

const ts = String(Date.now()).slice(-8);

describeOrSkip('Collection charge tenant scope (DB real)', () => {
  beforeAll(async () => {
    const db = getDb();

    // Create two clinics
    await db.execute(
      sql`INSERT INTO clinics (id, name, slug, phone, email)
          VALUES (${CLINIC_A}, 'Coll Scope Clinic A', 'coll-scope-a', '11999990001', 'a@coll-test.com')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO clinics (id, name, slug, phone, email)
          VALUES (${CLINIC_B}, 'Coll Scope Clinic B', 'coll-scope-b', '11999990002', 'b@coll-test.com')
          ON CONFLICT (id) DO NOTHING`,
    );

    // Create a patient for clinic A
    await db.execute(
      sql`INSERT INTO patients (id, clinic_id, name, phone)
          VALUES (${PATIENT_A}, ${CLINIC_A}, 'Patient Coll A', '11999990001')
          ON CONFLICT (id) DO NOTHING`,
    );

    // Create budget A (clinic A) with patient
    await db.execute(
      sql`INSERT INTO budgets (id, clinic_id, patient_id, title, total_value, final_value, status)
          VALUES (${BUDGET_A}, ${CLINIC_A}, ${PATIENT_A}, 'Budget A', '500.00', '500.00', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );

    // Create payment_gateway A (parent of payment_charges) — must exist before charges
    await db.execute(
      sql`INSERT INTO payment_gateways (id, clinic_id, provider, is_default, is_enabled)
          VALUES (${GATEWAY_A}, ${CLINIC_A}, 'asaas', true, true)
          ON CONFLICT (id) DO NOTHING`,
    );

    // Create an installment for budget A (used by repository scope tests)
    await db.execute(
      sql`INSERT INTO budget_installments (id, budget_id, amount, due_date, status)
          VALUES (${INSTALLMENT_A}, ${BUDGET_A}, '250.00', '2026-08-15', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );

    // Create charge A (clinic A, budget A, gateway A)
    await db.execute(
      sql`INSERT INTO payment_charges (id, clinic_id, budget_id, gateway_id, due_date, amount, status)
          VALUES (${CHARGE_A}, ${CLINIC_A}, ${BUDGET_A}, ${GATEWAY_A}, '2026-08-15', '500.00', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    // Children first (charges, installments), then parents (gateway, budget, patient, clinics)
    await db.execute(sql`DELETE FROM payment_charges WHERE id = ${CHARGE_A}`);
    await db.execute(sql`DELETE FROM budget_installments WHERE id = ${INSTALLMENT_A}`);
    await db.execute(sql`DELETE FROM payment_gateways WHERE id = ${GATEWAY_A}`);
    await db.execute(sql`DELETE FROM budgets WHERE id = ${BUDGET_A}`);
    await db.execute(sql`DELETE FROM patients WHERE id = ${PATIENT_A}`);
    await db.execute(sql`DELETE FROM clinics WHERE id IN (${CLINIC_A}, ${CLINIC_B})`);
    await closeDb();
  });

  it('scoped charge BY clinic: charge exists but belongs to other clinic returns no row', async () => {
    const db = getDb();

    // Query the charge with wrong clinicId — should return no row
    const result = await db.execute(
      sql`SELECT id FROM payment_charges WHERE id = ${CHARGE_A} AND clinic_id = ${CLINIC_B}`,
    );

    expect(result.rowCount).toBe(0);
  });

  it('scoped charge BY clinic: same clinic returns the charge', async () => {
    const db = getDb();

    const result = await db.execute(
      sql`SELECT id, clinic_id FROM payment_charges WHERE id = ${CHARGE_A} AND clinic_id = ${CLINIC_A}`,
    );

    expect(result.rowCount).toBe(1);
    expect(result.rows[0].clinic_id).toBe(CLINIC_A);
  });

  // ── Repository scope functions (cover financeiro-scope-repository) ──

  it('getBudgetForClinic returns budget for owning clinic only', async () => {
    const owned = await getBudgetForClinic(BUDGET_A, CLINIC_A);
    expect(owned).toBeDefined();
    expect(owned?.clinicId).toBe(CLINIC_A);

    const foreign = await getBudgetForClinic(BUDGET_A, CLINIC_B);
    expect(foreign).toBeUndefined();
  });

  it('getPaymentChargeForClinic returns charge for owning clinic only', async () => {
    const owned = await getPaymentChargeForClinic(CHARGE_A, CLINIC_A);
    expect(owned).toBeDefined();
    expect(owned?.clinicId).toBe(CLINIC_A);

    const foreign = await getPaymentChargeForClinic(CHARGE_A, CLINIC_B);
    expect(foreign).toBeUndefined();
  });

  it('updateInstallmentForBudget scopes update by budgetId', async () => {
    const updated = await updateInstallmentForBudget(INSTALLMENT_A, BUDGET_A, { amount: '111.00' });
    expect(updated).toBeDefined();
    expect(updated?.amount).toBe('111.00');

    // Cross-budget update must not match
    const cross = await updateInstallmentForBudget(INSTALLMENT_A, BUDGET_B, { amount: '999.00' });
    expect(cross).toBeUndefined();
  });

  it('deleteInstallmentForBudget scopes delete by budgetId', async () => {
    const deleted = await deleteInstallmentForBudget(INSTALLMENT_A, BUDGET_A);
    expect(deleted).toBeDefined();
    expect(deleted?.id).toBe(INSTALLMENT_A);
  });

  // ── sendReminder (collection-service) scope ───────────────────────────

  it('sendReminder with forged clinicId returns missing_patient_phone, charge unchanged', async () => {
    // Call sendReminder with CLINIC_B (charge belongs to CLINIC_A)
    const result = await sendReminder({
      clinicId: CLINIC_B,
      chargeId: CHARGE_A,
    });

    expect(result.sent).toBe(false);
    expect(result.error).toBe('missing_patient_phone');

    // Verify charge A still exists and unchanged in DB
    const db = getDb();
    const [row] = await db
      .select({ id: sql`id`, clinicId: sql`clinic_id`, amount: sql`amount`, status: sql`status` })
      .from(sql`payment_charges`)
      .where(sql`id = ${CHARGE_A}`);
    expect(row).toBeDefined();
    expect(row.clinicId).toBe(CLINIC_A);
    expect(row.amount).toBe('500.00');
  });

  it('sendReminder foreign charge with provided phone still returns missing_patient_phone (scope check first)', async () => {
    // Even with a valid phone number provided, the scope check happens before phone resolution
    const result = await sendReminder({
      clinicId: CLINIC_B,
      chargeId: CHARGE_A,
      patientPhone: '11999999999', // valid phone — but scope check rejects first
    });

    expect(result.sent).toBe(false);
    expect(result.error).toBe('missing_patient_phone');
  });

  it('sendReminder own clinic charge: scope does not block, error is not missing_patient_phone', async () => {
    const result = await sendReminder({
      clinicId: CLINIC_A,
      chargeId: CHARGE_A,
    });

    // Scope check passed — proceed to phone resolution + send attempt.
    expect(result.sent).toBe(false);
    expect(result.error).not.toBe('missing_patient_phone');
  });

  // ── Action-level entry test ──────────────────────────

  it('enviarLembreteCobranca action handler with forged clinicId returns missing_patient_phone', async () => {
    const db = getDb();

    // Build context directly — bypass permission check to test handler logic
    const ctx = await buildSystemContext(CLINIC_A);

    // Call handler directly (test the logic, not the permission gate)
    const result = await enviarLembreteCobranca.handler({
      clinicId: CLINIC_B,    // forged — charge belongs to CLINIC_A
      chargeId: CHARGE_A,
    }, ctx);

    expect(result.sent).toBe(false);
    expect(result.error).toBe('missing_patient_phone');

    // Charge A still exists and unchanged
    const [row] = await db
      .select({ id: sql`id`, clinicId: sql`clinic_id`, amount: sql`amount` })
      .from(sql`payment_charges`)
      .where(sql`id = ${CHARGE_A}`);
    expect(row).toBeDefined();
    expect(row.clinicId).toBe(CLINIC_A);
  });
});
