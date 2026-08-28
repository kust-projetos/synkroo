/**
 * Integration test: payments tenant scope — verifies list/register reject cross-tenant.
 *
 * Run via: npm run test:integration:run -- src/modules/financeiro/__tests__/payments-scope/integration.test.ts
 */

/** @jest-environment node */

jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }));

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import { listPayments, registerManualPayment } from '@/modules/financeiro/services/payment-service';
import { validateApiAuth } from '@/lib/auth/session';
import { GET as PaymentsGET, POST as PaymentsPOST } from '@/app/api/budgets/[id]/payments/route';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const CLINIC_A = '00000000-0000-0000-0000-0000a0010001';
const CLINIC_B = '00000000-0000-0000-0000-0000b0010001';
const BUDGET_A = '00000000-0000-0000-0000-0000c0010001';
const BUDGET_B = '00000000-0000-0000-0000-0000c0010002';
const GATEWAY_A = '00000000-0000-0000-0000-0000d0010001';
const GATEWAY_B = '00000000-0000-0000-0000-0000d0010002';
const CHARGE_A = '00000000-0000-0000-0000-0000e0010001';
const CHARGE_B = '00000000-0000-0000-0000-0000e0010002';
const PAYMENT_B = '00000000-0000-0000-0000-0000f0010002';
const USER_A = '00000000-0000-0000-0000-00000000a101';

function authAs(clinicId: string) {
  (validateApiAuth as jest.Mock).mockResolvedValue({
    success: true,
    profile: { id: USER_A, clinic_id: clinicId, role: 'owner' },
  });
}

describeOrSkip('Payments tenant scope — service + route', () => {
  beforeAll(async () => {
    const db = getDb();
    await db.execute(sql`INSERT INTO clinics (id, name, slug, phone, email) VALUES (${CLINIC_A}, 'Pay Scope A', 'pay-scope-a', '11999990011', 'pa@pay.test') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO clinics (id, name, slug, phone, email) VALUES (${CLINIC_B}, 'Pay Scope B', 'pay-scope-b', '11999990012', 'pb@pay.test') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO users (id, clinic_id, email, name, role) VALUES (${USER_A}, ${CLINIC_A}, 'pay-user-a@test.local', 'Pay User A', 'owner') ON CONFLICT (id) DO NOTHING`);

    await db.execute(sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status) VALUES (${BUDGET_A}, ${CLINIC_A}, 'Budget A', '500.00', '500.00', 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status) VALUES (${BUDGET_B}, ${CLINIC_B}, 'Budget B', '300.00', '300.00', 'pending') ON CONFLICT (id) DO NOTHING`);

    await db.execute(sql`INSERT INTO payment_gateways (id, clinic_id, provider, is_default, is_enabled, masked_label) VALUES (${GATEWAY_A}, ${CLINIC_A}, 'audit', true, true, 'gw-a') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO payment_gateways (id, clinic_id, provider, is_default, is_enabled, masked_label) VALUES (${GATEWAY_B}, ${CLINIC_B}, 'audit', true, true, 'gw-b') ON CONFLICT (id) DO NOTHING`);

    await db.execute(sql`INSERT INTO payment_charges (id, clinic_id, budget_id, gateway_id, external_charge_id, due_date, amount, status) VALUES (${CHARGE_A}, ${CLINIC_A}, ${BUDGET_A}, ${GATEWAY_A}, 'ext-a', CURRENT_DATE, '500.00', 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO payment_charges (id, clinic_id, budget_id, gateway_id, external_charge_id, due_date, amount, status) VALUES (${CHARGE_B}, ${CLINIC_B}, ${BUDGET_B}, ${GATEWAY_B}, 'ext-b', CURRENT_DATE, '300.00', 'pending') ON CONFLICT (id) DO NOTHING`);

    await db.execute(sql`INSERT INTO payments (id, clinic_id, budget_id, charge_id, amount, payment_method, status, paid_at) VALUES (${PAYMENT_B}, ${CLINIC_B}, ${BUDGET_B}, ${CHARGE_B}, '100.00', 'pix', 'settled', NOW()) ON CONFLICT (id) DO NOTHING`);
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM payments WHERE id = ${PAYMENT_B}`);
    await db.execute(sql`DELETE FROM payment_charges WHERE id IN (${CHARGE_A}, ${CHARGE_B})`);
    await db.execute(sql`DELETE FROM payment_gateways WHERE id IN (${GATEWAY_A}, ${GATEWAY_B})`);
    await db.execute(sql`DELETE FROM budget_installments WHERE budget_id IN (${BUDGET_A}, ${BUDGET_B})`);
    await db.execute(sql`DELETE FROM budgets WHERE id IN (${BUDGET_A}, ${BUDGET_B})`);
    await db.execute(sql`DELETE FROM users WHERE id = ${USER_A}`);
    await db.execute(sql`DELETE FROM clinics WHERE id IN (${CLINIC_A}, ${CLINIC_B})`);
    await closeDb();
  });

  beforeEach(() => {
    (validateApiAuth as jest.Mock).mockReset();
  });

  it('listPayments rejects foreign budget (clinic A trying budget B)', async () => {
    await expect(listPayments(CLINIC_A, BUDGET_B)).rejects.toMatchObject({ code: 'not_found' });
    // Ensure B's payment still exists
    const own = await listPayments(CLINIC_B, BUDGET_B);
    expect(own).toHaveLength(1);
    expect(own[0].id).toBe(PAYMENT_B);
  });

  it('registerManualPayment rejects foreign budget', async () => {
    const before = await getDb().execute(sql`SELECT count(*) as c FROM payments WHERE budget_id = ${BUDGET_B}`);
    const countBefore = Number((before.rows as any)[0].c);
    await expect(
      registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_B, amount: 50, paymentMethod: 'pix', actorUserId: USER_A }),
    ).rejects.toMatchObject({ code: 'not_found' });
    const after = await getDb().execute(sql`SELECT count(*) as c FROM payments WHERE budget_id = ${BUDGET_B}`);
    const countAfter = Number((after.rows as any)[0].c);
    expect(countAfter).toBe(countBefore);
  });

  it('registerManualPayment rejects foreign chargeId', async () => {
    await expect(
      registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_A, chargeId: CHARGE_B, amount: 50, paymentMethod: 'pix', actorUserId: USER_A }),
    ).rejects.toMatchObject({ code: 'not_found' });
    // Also rejects when charge belongs to different budget
    await expect(
      registerManualPayment({ clinicId: CLINIC_B, budgetId: BUDGET_A, chargeId: CHARGE_B, amount: 50, paymentMethod: 'pix', actorUserId: USER_A }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('registerManualPayment succeeds for own budget and records actor', async () => {
    const payment = await registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_A, chargeId: CHARGE_A, amount: 123, paymentMethod: 'pix', actorUserId: USER_A });
    expect(payment.clinicId).toBe(CLINIC_A);
    expect(payment.budgetId).toBe(BUDGET_A);
    expect(payment.createdBy).toBe(USER_A);
    // Cleanup created payment
    await getDb().execute(sql`DELETE FROM payments WHERE id = ${payment.id}`);
    // Charge should be marked paid
    const charge = await getDb().execute(sql`SELECT status FROM payment_charges WHERE id = ${CHARGE_A}`);
    expect((charge.rows as any)[0].status).toBe('paid');
    // Reset charge for other tests
    await getDb().execute(sql`UPDATE payment_charges SET status = 'pending', paid_at = NULL WHERE id = ${CHARGE_A}`);
  });

  it('GET /api/budgets/[id]/payments returns 404 for foreign budget and does not leak', async () => {
    authAs(CLINIC_A);
    const db = getDb();
    const before = await db.execute(sql`SELECT count(*) as c FROM payments WHERE budget_id = ${BUDGET_B}`);
    const countBefore = Number((before.rows as any)[0].c);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_B + '/payments');
    const res = await PaymentsGET(req as any, { params: Promise.resolve({ id: BUDGET_B }) } as any);
    expect(res.status).toBe(404);
    const after = await db.execute(sql`SELECT count(*) as c FROM payments WHERE budget_id = ${BUDGET_B}`);
    expect(Number((after.rows as any)[0].c)).toBe(countBefore);
  });

  it('POST /api/budgets/[id]/payments rejects foreign budget without creating payment', async () => {
    authAs(CLINIC_A);
    const before = await getDb().execute(sql`SELECT count(*) as c FROM payments WHERE budget_id = ${BUDGET_B}`);
    const countBefore = Number((before.rows as any)[0].c);
    const req = new Request('http://localhost/api/budgets/' + BUDGET_B + '/payments', {
      method: 'POST',
      body: JSON.stringify({ amount: 50, payment_method: 'pix' }),
    });
    const res = await PaymentsPOST(req as any, { params: Promise.resolve({ id: BUDGET_B }) } as any);
    expect(res.status).toBe(404);
    const after = await getDb().execute(sql`SELECT count(*) as c FROM payments WHERE budget_id = ${BUDGET_B}`);
    expect(Number((after.rows as any)[0].c)).toBe(countBefore);
  });
});
