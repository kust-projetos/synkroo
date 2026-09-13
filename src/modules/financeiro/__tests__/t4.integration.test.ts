/** @jest-environment node */
const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
jest.unmock('@/lib/db/client');

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import { registerManualPayment } from '@/modules/financeiro/services/payment-service';
import { processGatewayEventAtomically } from '@/modules/financeiro/repositories/financeiro-repository';
import { Pool } from 'pg';

const CLINIC_A = '00000000-0000-4000-8000-000000000001';
const CLINIC_B = '00000000-0000-4000-8000-000000000002';
const USER_A = '00000000-0000-0000-0000-000000000003';
const BUDGET_A = '00000000-0000-4000-8000-000000000004';
const BUDGET_B = '00000000-0000-4000-8000-000000000005';
const GATEWAY_A = '00000000-0000-4000-8000-000000000006';
const CHARGE_A = '00000000-0000-4000-8000-000000000007';
const INSTALL_A1 = '00000000-0000-4000-8000-000000000008';
const INSTALL_A2 = '00000000-0000-4000-8000-000000000009';

describeOrSkip('T4 — finance forward-only integration (TEST_DATABASE_URL loopback)', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  beforeAll(async () => {
    const db = getDb();
    await db.execute(sql`INSERT INTO clinics (id, name, slug, phone, email) VALUES (${CLINIC_A}, 'T4 Clinic A', 't4-a', '11999990001', 't4-a@test.local') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO clinics (id, name, slug, phone, email) VALUES (${CLINIC_B}, 'T4 Clinic B', 't4-b', '11999990002', 't4-b@test.local') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO users (id, clinic_id, email, name, role) VALUES (${USER_A}, ${CLINIC_A}, 't4-a@test.local', 'T4 A', 'owner') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status) VALUES (${BUDGET_A}, ${CLINIC_A}, 'T4 Budget', '500.00', '500.00', 'pending') ON CONFLICT (id) DO UPDATE SET final_value='500.00'`);
    await db.execute(sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status) VALUES (${BUDGET_B}, ${CLINIC_B}, 'T4 Budget B', '300.00', '300.00', 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO payment_gateways (id, clinic_id, provider, is_default, is_enabled) VALUES (${GATEWAY_A}, ${CLINIC_A}, 'asaas', true, true) ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO payment_charges (id, clinic_id, budget_id, gateway_id, external_charge_id, due_date, amount, status) VALUES (${CHARGE_A}, ${CLINIC_A}, ${BUDGET_A}, ${GATEWAY_A}, 'ext-t4-a', CURRENT_DATE, '500.00', 'pending') ON CONFLICT (id) DO UPDATE SET status='pending', amount='500.00'`);
    await db.execute(sql`INSERT INTO budget_installments (id, budget_id, amount, due_date, status) VALUES (${INSTALL_A1}, ${BUDGET_A}, '250.00', CURRENT_DATE, 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO budget_installments (id, budget_id, amount, due_date, status) VALUES (${INSTALL_A2}, ${BUDGET_A}, '250.00', CURRENT_DATE + INTERVAL '1 day', 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`DELETE FROM payments WHERE budget_id = ${BUDGET_A}`);
    await db.execute(sql`DELETE FROM gateway_events WHERE charge_id = ${CHARGE_A}`);
    await db.execute(sql`UPDATE payment_charges SET status='pending', paid_at=NULL WHERE id=${CHARGE_A}`);
    await db.execute(sql`UPDATE budget_installments SET status='pending', paid_at=NULL WHERE budget_id=${BUDGET_A}`);
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM gateway_events WHERE charge_id = ${CHARGE_A}`);
    await db.execute(sql`DELETE FROM payments WHERE budget_id IN (${BUDGET_A}, ${BUDGET_B})`);
    await db.execute(sql`DELETE FROM payment_charges WHERE id = ${CHARGE_A}`);
    await db.execute(sql`DELETE FROM budget_installments WHERE id IN (${INSTALL_A1}, ${INSTALL_A2})`);
    await db.execute(sql`DELETE FROM budgets WHERE id IN (${BUDGET_A}, ${BUDGET_B})`);
    await db.execute(sql`DELETE FROM payment_gateways WHERE id = ${GATEWAY_A}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${USER_A}`);
    await db.execute(sql`DELETE FROM clinics WHERE id IN (${CLINIC_A}, ${CLINIC_B})`);
    await closeDb();
    await pool.end();
  });

  beforeEach(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM payments WHERE budget_id = ${BUDGET_A}`);
    await db.execute(sql`DELETE FROM gateway_events WHERE charge_id = ${CHARGE_A}`);
    await db.execute(sql`UPDATE payment_charges SET status='pending', paid_at=NULL WHERE id=${CHARGE_A}`);
    await db.execute(sql`UPDATE budget_installments SET status='pending', paid_at=NULL WHERE budget_id=${BUDGET_A}`);
  });

  it('two concurrent manual payments do not exceed total (500)', async () => {
    const p1 = registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_A, amount: 300, paymentMethod: 'pix', actorUserId: USER_A });
    const p2 = registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_A, amount: 300, paymentMethod: 'pix', actorUserId: USER_A });
    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    const sumRow: any = await getDb().execute(sql`SELECT COALESCE(SUM(amount::numeric),0) as s FROM payments WHERE budget_id=${BUDGET_A}`);
    const sum = Number(sumRow.rows[0].s);
    expect(sum).toBeLessThanOrEqual(500);
    expect(sum).toBe(300);
  });

  it('duplicate gateway event does not create second payment', async () => {
    const payload = { id: 'evt-dup-t4', event: 'PAYMENT_RECEIVED', payment: { id: 'ext-t4-a', value: 500, status: 'RECEIVED' } } as any;
    const first = await processGatewayEventAtomically({ clinicId: CLINIC_A, gatewayId: GATEWAY_A, provider: 'asaas', externalEventId: 'evt-dup-t4', externalChargeId: 'ext-t4-a', payload, settlement: true, amount: '500.00', paidAt: new Date().toISOString() });
    expect(first.settled).toBe(true);
    const second = await processGatewayEventAtomically({ clinicId: CLINIC_A, gatewayId: GATEWAY_A, provider: 'asaas', externalEventId: 'evt-dup-t4', externalChargeId: 'ext-t4-a', payload, settlement: true, amount: '500.00', paidAt: new Date().toISOString() });
    expect(second.duplicate).toBe(true);
    const cnt: any = await getDb().execute(sql`SELECT count(*) as c FROM payments WHERE charge_id=${CHARGE_A}`);
    expect(Number(cnt.rows[0].c)).toBe(1);
  });

  it('PIX parcial 10 de 500 não marca paid (partially_paid)', async () => {
    const payload = { id: 'evt-partial-t4', event: 'PAYMENT_RECEIVED', payment: { id: 'ext-t4-a', value: 10, status: 'RECEIVED' } } as any;
    const res = await processGatewayEventAtomically({ clinicId: CLINIC_A, gatewayId: GATEWAY_A, provider: 'asaas', externalEventId: 'evt-partial-t4', externalChargeId: 'ext-t4-a', payload, settlement: true, amount: '10.00', paidAt: new Date().toISOString() });
    expect(res.settled).toBe(true);
    const charge: any = await getDb().execute(sql`SELECT status FROM payment_charges WHERE id=${CHARGE_A}`);
    expect(charge.rows[0].status).toBe('partially_paid');
    const payCnt: any = await getDb().execute(sql`SELECT count(*) as c FROM payments WHERE charge_id=${CHARGE_A}`);
    expect(Number(payCnt.rows[0].c)).toBe(1);
  });

  it('estorno terminal não volta a paid em retry tardio', async () => {
    // First settle
    const payPayload = { id: 'evt-paid-t4', event: 'PAYMENT_RECEIVED', payment: { id: 'ext-t4-a', value: 500, status: 'RECEIVED' } } as any;
    await processGatewayEventAtomically({ clinicId: CLINIC_A, gatewayId: GATEWAY_A, provider: 'asaas', externalEventId: 'evt-paid-t4', externalChargeId: 'ext-t4-a', payload: payPayload, settlement: true, amount: '500.00', paidAt: new Date().toISOString() });
    // Refund (terminal)
    const refundPayload = { id: 'evt-refund-t4', event: 'PAYMENT_REFUNDED', payment: { id: 'ext-t4-a', value: 500, status: 'REFUNDED' } } as any;
    await processGatewayEventAtomically({ clinicId: CLINIC_A, gatewayId: GATEWAY_A, provider: 'asaas', externalEventId: 'evt-refund-t4', externalChargeId: 'ext-t4-a', payload: refundPayload, settlement: false, amount: '500.00', paidAt: new Date().toISOString() });
    let charge: any = await getDb().execute(sql`SELECT status FROM payment_charges WHERE id=${CHARGE_A}`);
    expect(charge.rows[0].status).toBe('cancelled');
    // Late retry of paid should not revert
    const retryPayload = { id: 'evt-retry-t4', event: 'PAYMENT_RECEIVED', payment: { id: 'ext-t4-a', value: 500, status: 'RECEIVED' } } as any;
    const retry = await processGatewayEventAtomically({ clinicId: CLINIC_A, gatewayId: GATEWAY_A, provider: 'asaas', externalEventId: 'evt-retry-t4', externalChargeId: 'ext-t4-a', payload: retryPayload, settlement: true, amount: '500.00', paidAt: new Date().toISOString() });
    expect(retry.settled).toBe(false);
    charge = await getDb().execute(sql`SELECT status FROM payment_charges WHERE id=${CHARGE_A}`);
    expect(charge.rows[0].status).toBe('cancelled');
  });

  it('cross-tenant: clinic B cannot pay budget A (not_found)', async () => {
    await expect(registerManualPayment({ clinicId: CLINIC_B, budgetId: BUDGET_A, amount: 100, paymentMethod: 'pix', actorUserId: USER_A })).rejects.toMatchObject({ code: 'not_found' });
    const cnt: any = await getDb().execute(sql`SELECT count(*) as c FROM payments WHERE clinic_id=${CLINIC_B} AND budget_id=${BUDGET_A}`);
    expect(Number(cnt.rows[0].c)).toBe(0);
  });

  it('installments updated atomically with payment', async () => {
    await registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_A, amount: 250, paymentMethod: 'pix', actorUserId: USER_A });
    const inst: any = await getDb().execute(sql`SELECT status FROM budget_installments WHERE id=${INSTALL_A1}`);
    expect(inst.rows[0].status).toBe('paid');
    const inst2: any = await getDb().execute(sql`SELECT status FROM budget_installments WHERE id=${INSTALL_A2}`);
    expect(inst2.rows[0].status).toBe('pending');
    // Second payment should pay second installment
    await registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_A, amount: 250, paymentMethod: 'pix', actorUserId: USER_A });
    const inst2After: any = await getDb().execute(sql`SELECT status FROM budget_installments WHERE id=${INSTALL_A2}`);
    expect(inst2After.rows[0].status).toBe('paid');
  });

  it('mutation: removing clinicId from where should be caught by cross-tenant test (negative)', async () => {
    // This test documents that tenant scoping is via clinicId predicate; if removed, cross-tenant would pass
    // We verify that without clinicId, a foreign clinic could access — our code prevents
    const before: any = await getDb().execute(sql`SELECT count(*) as c FROM payments WHERE budget_id=${BUDGET_A}`);
    const countBefore = Number(before.rows[0].c);
    await expect(registerManualPayment({ clinicId: CLINIC_A, budgetId: BUDGET_B, amount: 50, paymentMethod: 'pix', actorUserId: USER_A })).rejects.toMatchObject({ code: 'not_found' });
    const after: any = await getDb().execute(sql`SELECT count(*) as c FROM payments WHERE budget_id=${BUDGET_A}`);
    expect(Number(after.rows[0].c)).toBe(countBefore);
  });
});
