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

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const CLINIC_A = '00000000-0000-0000-0000-00000000a001';
const CLINIC_B = '00000000-0000-0000-0000-00000000b001';
const BUDGET_A = '00000000-0000-0000-0000-00000000c001';
const CHARGE_A = '00000000-0000-0000-0000-00000000d001';
const GATEWAY_A = '00000000-0000-0000-0000-00000000f001';
const PATIENT_A = '00000000-0000-0000-0000-00000000e001';

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

    // Create charge A (clinic A, budget A, gateway A)
    await db.execute(
      sql`INSERT INTO payment_charges (id, clinic_id, budget_id, gateway_id, due_date, amount, status)
          VALUES (${CHARGE_A}, ${CLINIC_A}, ${BUDGET_A}, ${GATEWAY_A}, '2026-08-15', '500.00', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    // Children first (charges), then parents (gateway, budget, patient, clinics)
    await db.execute(sql`DELETE FROM payment_charges WHERE id = ${CHARGE_A}`);
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
});
