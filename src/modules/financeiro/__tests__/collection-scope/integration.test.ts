/**
 * Integration test: collection charge tenant scope — verifies enviarLembreteCobranca
 * action entry (via runAction) rejects cross-tenant charges.
 *
 * Scope: getPaymentChargeForClinic checks chargeId+clinicId before any phone
 * resolution.  Production already calls it; no production changes.
 *
 * Run via: npm run test:integration:run -- src/modules/financeiro/__tests__/collection-scope/integration.test.ts
 */

/** @jest-environment node */

import { sql, eq, and } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import {
  getBudgetForClinic,
  updateInstallmentForBudget,
  deleteInstallmentForBudget,
  getPaymentChargeForClinic,
} from '@/modules/financeiro/repositories/financeiro-scope-repository';
import { sendReminder } from '@/modules/financeiro/services/collection-service';
import { runAction } from '@/core/actions/run';
import { buildDelegatedContext } from '@/core/actions/context';
import { enviarLembreteCobranca } from '@/modules/financeiro/actions/enviar-lembrete-cobranca';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { roles, userClinicAccess } from '@/modules/core/schema/rbac';
import { users } from '@/lib/db/schema/core';
import { instanceModules } from '@/lib/db/schema/modules';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const CLINIC_A = '00000000-0000-0000-0000-00000000a001';
const CLINIC_B = '00000000-0000-0000-0000-00000000b001';
const BUDGET_A = '00000000-0000-0000-0000-00000000c001';
const BUDGET_B = '00000000-0000-0000-0000-00000000c002';
const CHARGE_A = '00000000-0000-0000-0000-00000000d001';
const CHARGE_B = '00000000-0000-0000-0000-00000000d003';
const GATEWAY_A = '00000000-0000-0000-0000-00000000f001';
const GATEWAY_B = '00000000-0000-0000-0000-00000000f003';
const PATIENT_A = '00000000-0000-0000-0000-00000000e001';
const PATIENT_B = '00000000-0000-0000-0000-00000000e003';
const INSTALLMENT_A = '00000000-0000-0000-0000-00000000d002';
const USER_ID = '00000000-0000-0000-0000-00000000f002';

let ctx: Awaited<ReturnType<typeof buildDelegatedContext>>;

/** Snapshot a charge row for before/after comparison. */
async function snapshotCharge(db: any, chargeId: string) {
  const { rows } = await db.execute(
    sql`SELECT id, clinic_id as "clinicId", budget_id as "budgetId",
               amount, status, due_date as "dueDate"
        FROM payment_charges WHERE id = ${chargeId}`,
  );
  return rows[0] || null;
}

describeOrSkip('Collection charge tenant scope (DB real)', () => {
  beforeAll(async () => {
    const db = getDb();

    // Create clinics
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

    // Seed RBAC for delegated context
    await seedRbacForClinic(CLINIC_A);
    const [ownerRow] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.clinicId, CLINIC_A), eq(roles.name, RESERVED_ROLE_OWNER)))
      .limit(1);

    // Create test user with owner role
    await db.insert(users).values({
      id: USER_ID, clinicId: CLINIC_A, email: 'coll-test@t.local', name: 'Coll Test User',
      role: 'owner', isActive: true,
    }).onConflictDoNothing();

    await db.insert(userClinicAccess).values({
      userId: USER_ID, clinicId: CLINIC_A, roleId: ownerRow!.id,
    }).onConflictDoNothing();

    // Enable financeiro module
    await db.insert(instanceModules).values({ moduleId: 'financeiro', enabled: true })
      .onConflictDoUpdate({ target: instanceModules.moduleId, set: { enabled: true } });

    // Build delegated context (user has financeiro:manage_collections via Owner role)
    ctx = await buildDelegatedContext(USER_ID, CLINIC_A);

    // Create patient, gateway, budget, installment, charge for CLINIC_A
    await db.execute(
      sql`INSERT INTO patients (id, clinic_id, name, phone)
          VALUES (${PATIENT_A}, ${CLINIC_A}, 'Patient Coll A', '11999990001')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO payment_gateways (id, clinic_id, provider, is_default, is_enabled)
          VALUES (${GATEWAY_A}, ${CLINIC_A}, 'asaas', true, true)
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO budgets (id, clinic_id, patient_id, title, total_value, final_value, status)
          VALUES (${BUDGET_A}, ${CLINIC_A}, ${PATIENT_A}, 'Budget A', '500.00', '500.00', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO budget_installments (id, budget_id, amount, due_date, status)
          VALUES (${INSTALLMENT_A}, ${BUDGET_A}, '250.00', '2026-08-15', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO payment_charges (id, clinic_id, budget_id, gateway_id, due_date, amount, status)
          VALUES (${CHARGE_A}, ${CLINIC_A}, ${BUDGET_A}, ${GATEWAY_A}, '2026-08-15', '500.00', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );

    // Create patient, gateway, budget, charge for CLINIC_B (for RED test proving bypass)
    await db.execute(
      sql`INSERT INTO patients (id, clinic_id, name, phone)
          VALUES (${PATIENT_B}, ${CLINIC_B}, 'Patient Coll B', '11999990002')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO payment_gateways (id, clinic_id, provider, is_default, is_enabled)
          VALUES (${GATEWAY_B}, ${CLINIC_B}, 'asaas', true, true)
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO budgets (id, clinic_id, patient_id, title, total_value, final_value, status)
          VALUES (${BUDGET_B}, ${CLINIC_B}, ${PATIENT_B}, 'Budget B', '300.00', '300.00', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO payment_charges (id, clinic_id, budget_id, gateway_id, due_date, amount, status)
          VALUES (${CHARGE_B}, ${CLINIC_B}, ${BUDGET_B}, ${GATEWAY_B}, '2026-09-01', '300.00', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.update(instanceModules).set({ enabled: false }).where(eq(instanceModules.moduleId, 'financeiro'));
    await db.execute(sql`DELETE FROM payment_charges WHERE id IN (${CHARGE_A}, ${CHARGE_B})`);
    await db.execute(sql`DELETE FROM budget_installments WHERE id IN (${INSTALLMENT_A})`);
    await db.execute(sql`DELETE FROM payment_gateways WHERE id IN (${GATEWAY_A}, ${GATEWAY_B})`);
    await db.execute(sql`DELETE FROM budgets WHERE id IN (${BUDGET_A}, ${BUDGET_B})`);
    await db.execute(sql`DELETE FROM patients WHERE id IN (${PATIENT_A}, ${PATIENT_B})`);
    await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, USER_ID));
    await db.delete(users).where(eq(users.id, USER_ID));
    await db.delete(roles).where(eq(roles.clinicId, CLINIC_A));
    await db.delete(roles).where(eq(roles.clinicId, CLINIC_B));
    await db.execute(sql`DELETE FROM clinics WHERE id IN (${CLINIC_A}, ${CLINIC_B})`);
    await closeDb();
  });

  // ── Raw SQL scope checks ─────────────────────────────

  it('scoped charge BY clinic: wrong clinic returns no row', async () => {
    const db = getDb();
    const result = await db.execute(
      sql`SELECT id FROM payment_charges WHERE id = ${CHARGE_A} AND clinic_id = ${CLINIC_B}`,
    );
    expect(result.rowCount).toBe(0);
  });

  it('scoped charge BY clinic: own clinic returns the charge', async () => {
    const db = getDb();
    const result = await db.execute(
      sql`SELECT id, clinic_id FROM payment_charges WHERE id = ${CHARGE_A} AND clinic_id = ${CLINIC_A}`,
    );
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].clinic_id).toBe(CLINIC_A);
  });

  // ── Repository scope functions ────────────────────────

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

  // ── Action entry (via runAction) ──────────────────────

  // RED TEST: ctx CLINIC_A, input clinicId=CLINIC_B, charge=CHARGE_B (belongs to B)
  // Before fix: action uses input.clinicId (CLINIC_B) -> scope passes -> may access B's data
  // After fix: action uses ctx.clinicId (CLINIC_A) -> scope fails -> missing_patient_phone
  it('RED: action uses ctx.clinicId not input.clinicId; forged clinicId cannot access foreign charge', async () => {
    const db = getDb();
    const chargeId = CHARGE_B;

    try {
      const before = await snapshotCharge(db, chargeId);
      expect(before).toBeDefined();
      expect(before.clinicId).toBe(CLINIC_B);

      const [{ count: countBefore }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sql`payment_charges`)
        .where(sql`id = ${chargeId}`);

      // ctx is CLINIC_A, input says CLINIC_B — action must use ctx.clinicId
      const result = await runAction(enviarLembreteCobranca, {
        clinicId: CLINIC_B,
        chargeId,
        patientPhone: '11999999999',  // valid phone — would proceed if scope passed
      }, ctx);

      // After fix: ctx.clinicId (A) doesn't own CHARGE_B (B) -> missing_patient_phone
      expect(result.ok).toBe(true);
      const data = (result as any).data as { sent: boolean; error?: string };
      expect(data.sent).toBe(false);
      expect(data.error).toBe('missing_patient_phone');

      // Charge B untouched
      const after = await snapshotCharge(db, chargeId);
      expect(after).toEqual(before);

      const [{ count: countAfter }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sql`payment_charges`)
        .where(sql`id = ${chargeId}`);
      expect(countAfter).toBe(countBefore);
    } finally {
      // afterAll cleans up
    }
  });

  it('action entry: forged clinicId in input is ignored, own-clinic charge scope passes', async () => {
    const db = getDb();
    const chargeId = CHARGE_A;

    try {
      const before = await snapshotCharge(db, chargeId);
      expect(before).toBeDefined();
      expect(before.clinicId).toBe(CLINIC_A);

      // Action entry with clinicId falseado no input — ctx.clinicId (A) used
      const result = await runAction(enviarLembreteCobranca, {
        clinicId: CLINIC_B,  // forged — action ignores, uses ctx.clinicId
        chargeId,
      }, ctx);

      // ctx.clinicId (A) owns CHARGE_A (A) → scope passes
      // Fails later on phone resolution/WhatsApp send
      expect(result.ok).toBe(true);
      const data = (result as any).data as { sent: boolean; error?: string };
      expect(data.sent).toBe(false);
      // Error is NOT missing_patient_phone — scope passed
      expect(data.error).not.toBe('missing_patient_phone');

      const after = await snapshotCharge(db, chargeId);
      expect(after).toEqual(before);
    } finally {
      // afterAll cleans up
    }
  });

  // ── sendReminder service-level (additional coverage) ──

  it('sendReminder with forged clinicId returns missing_patient_phone', async () => {
    const db = getDb();
    try {
      const result = await sendReminder({
        clinicId: CLINIC_B,
        chargeId: CHARGE_A,
      });

      expect(result.sent).toBe(false);
      expect(result.error).toBe('missing_patient_phone');

      const [row] = await db
        .select({ id: sql`id`, clinicId: sql`clinic_id`, amount: sql`amount` })
        .from(sql`payment_charges`)
        .where(sql`id = ${CHARGE_A}`);
      expect(row).toBeDefined();
      expect(row.clinicId).toBe(CLINIC_A);
      expect(row.amount).toBe('500.00');
    } finally {
      // afterAll cleans up
    }
  });

  it('sendReminder foreign charge + provided phone still returns missing_patient_phone', async () => {
    try {
      const result = await sendReminder({
        clinicId: CLINIC_B,
        chargeId: CHARGE_A,
        patientPhone: '11999999999',
      });

      expect(result.sent).toBe(false);
      expect(result.error).toBe('missing_patient_phone');
    } finally {
      // afterAll cleans up
    }
  });

  it('sendReminder own clinic charge: scope passes, error is not missing_patient_phone', async () => {
    try {
      const result = await sendReminder({
        clinicId: CLINIC_A,
        chargeId: CHARGE_A,
      });

      expect(result.sent).toBe(false);
      expect(result.error).not.toBe('missing_patient_phone');
    } finally {
      // afterAll cleans up
    }
  });
});
