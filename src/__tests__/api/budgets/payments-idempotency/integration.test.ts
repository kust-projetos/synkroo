/**
 * Integration test: POST /api/budgets/[id]/payments idempotency (Etapa 4).
 *
 * Proves the Idempotency-Key contract on manual payment registration:
 *   - 2 POSTs with the SAME key + same body → 201 both, SAME payment id, exactly 1 row;
 *   - 2 POSTs with DIFFERENT keys → 201 both, different ids, 2 rows.
 *
 * Each case uses its own budget fixture so cases stay order-independent.
 * buildUserContext is spied (proven pattern from payments-scope); repositories
 * hit the real Drizzle DB.
 *
 * Run via: npm run test:integration:run -- src/__tests__/api/budgets/payments-idempotency/integration.test.ts
 */

/** @jest-environment node */

jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn(), getUserProfile: jest.fn() }));

import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import { POST as PaymentsPOST } from '@/app/api/budgets/[id]/payments/route';
import { registerManualPayment } from '@/modules/financeiro/services/payment-service';
import * as contextModule from '@/core/actions/context';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const CLINIC = '00000000-0000-0000-0000-0000a0020001';
const USER = '00000000-0000-0000-0000-00000000a102';
const GATEWAY = '00000000-0000-0000-0000-0000d0020001';
const BUDGET_SAME = '00000000-0000-0000-0000-0000c0020001';
const BUDGET_DIFF = '00000000-0000-0000-0000-0000c0020002';
const BUDGET_MISMATCH = '00000000-0000-0000-0000-0000c0020003';
const BUDGET_NOTES = '00000000-0000-0000-0000-0000c0020005';
const BUDGET_RACE = '00000000-0000-0000-0000-0000c0020004';
const BUDGET_CHARGE = '00000000-0000-0000-0000-0000c0020006';
const BUDGET_PAIDAT = '00000000-0000-0000-0000-0000c0020007';
const buildUserContextMock = jest.spyOn(contextModule, 'buildUserContext');

function authAs(clinicId: string) {
  buildUserContextMock.mockResolvedValue({
    source: 'user',
    clinicId,
    user: { id: USER, email: 'pay-idem@test.local', name: 'Pay Idem' },
    role: 'owner',
    can: () => true,
    hasModule: () => true,
    audit: { actor: USER },
  } as any);
}

function postPayment(budgetId: string, body: Record<string, unknown>, key?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['Idempotency-Key'] = key;
  const req = new Request(`http://localhost/api/budgets/${budgetId}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return PaymentsPOST(req as any, { params: Promise.resolve({ id: budgetId }) } as any);
}

async function countPayments(budgetId: string): Promise<number> {
  const db = getDb();
  const { rows } = await db.execute(
    sql`SELECT count(*) as c FROM payments WHERE budget_id = ${budgetId}`,
  );
  return Number((rows as any)[0].c);
}

describeOrSkip('POST /api/budgets/[id]/payments idempotency — route + DB real', () => {
  beforeAll(async () => {
    const db = getDb();
    await db.execute(sql`INSERT INTO clinics (id, name, slug, phone, email) VALUES (${CLINIC}, 'Pay Idem Clinic', 'pay-idem', '11999990401', 'pay-idem@test.com') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO users (id, clinic_id, email, name, role) VALUES (${USER}, ${CLINIC}, 'pay-idem@test.local', 'Pay Idem', 'owner') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO payment_gateways (id, clinic_id, provider, is_default, is_enabled, masked_label) VALUES (${GATEWAY}, ${CLINIC}, 'audit', true, true, 'gw-idem') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status) VALUES (${BUDGET_SAME}, ${CLINIC}, 'Pay Idem Same', '500.00', '500.00', 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status) VALUES (${BUDGET_DIFF}, ${CLINIC}, 'Pay Idem Diff', '500.00', '500.00', 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status) VALUES (${BUDGET_MISMATCH}, ${CLINIC}, 'Pay Idem Mismatch', '500.00', '500.00', 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status) VALUES (${BUDGET_NOTES}, ${CLINIC}, 'Pay Idem Notes', '500.00', '500.00', 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status) VALUES (${BUDGET_RACE}, ${CLINIC}, 'Pay Idem Race', '500.00', '500.00', 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status) VALUES (${BUDGET_CHARGE}, ${CLINIC}, 'Pay Idem Charge', '500.00', '500.00', 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status) VALUES (${BUDGET_PAIDAT}, ${CLINIC}, 'Pay Idem PaidAt', '500.00', '500.00', 'pending') ON CONFLICT (id) DO NOTHING`);
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM payments WHERE budget_id IN (${BUDGET_SAME}, ${BUDGET_DIFF}, ${BUDGET_MISMATCH}, ${BUDGET_NOTES}, ${BUDGET_RACE}, ${BUDGET_CHARGE}, ${BUDGET_PAIDAT})`);
    await db.execute(sql`DELETE FROM idempotency_keys WHERE key LIKE ${'payment:manual:' + CLINIC + ':%'}`);
    await db.execute(sql`DELETE FROM budget_installments WHERE budget_id IN (${BUDGET_SAME}, ${BUDGET_DIFF}, ${BUDGET_MISMATCH}, ${BUDGET_NOTES}, ${BUDGET_RACE}, ${BUDGET_CHARGE}, ${BUDGET_PAIDAT})`);
    await db.execute(sql`DELETE FROM budgets WHERE id IN (${BUDGET_SAME}, ${BUDGET_DIFF}, ${BUDGET_MISMATCH}, ${BUDGET_NOTES}, ${BUDGET_RACE}, ${BUDGET_CHARGE}, ${BUDGET_PAIDAT})`);
    await db.execute(sql`DELETE FROM payment_gateways WHERE id = ${GATEWAY}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${USER}`);
    await db.execute(sql`DELETE FROM clinics WHERE id = ${CLINIC}`);
    buildUserContextMock.mockRestore();
    await closeDb();
  });

  beforeEach(() => {
    buildUserContextMock.mockReset();
  });

  it('duplicate retry with the SAME key returns the ORIGINAL payment, no second row', async () => {
    authAs(CLINIC);
    const key = `pay-idem-same-${randomUUID()}`;
    const body = { amount: 100, payment_method: 'pix' };

    const res1 = await postPayment(BUDGET_SAME, body, key);
    expect(res1.status).toBe(201);
    const json1 = await res1.json();
    const id1 = json1.payment?.id;
    expect(id1).toBeDefined();

    const res2 = await postPayment(BUDGET_SAME, body, key);
    expect(res2.status).toBe(201);
    const json2 = await res2.json();
    expect(json2.payment?.id).toBe(id1);

    expect(await countPayments(BUDGET_SAME)).toBe(1);
  });

  it('two POSTs with DIFFERENT keys create two payments', async () => {
    authAs(CLINIC);

    const res1 = await postPayment(BUDGET_DIFF, { amount: 100, payment_method: 'pix' }, `pay-idem-diff-${randomUUID()}`);
    expect(res1.status).toBe(201);
    const id1 = (await res1.json()).payment?.id;

    const res2 = await postPayment(BUDGET_DIFF, { amount: 120, payment_method: 'pix' }, `pay-idem-diff-${randomUUID()}`);
    expect(res2.status).toBe(201);
    const id2 = (await res2.json()).payment?.id;

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id2).not.toBe(id1);
    expect(await countPayments(BUDGET_DIFF)).toBe(2);
  });

  it('same key + DIFFERENT payload → 409 CONFLICT, nenhuma segunda linha', async () => {
    authAs(CLINIC);
    const key = `pay-idem-mismatch-${randomUUID()}`;

    const res1 = await postPayment(BUDGET_MISMATCH, { amount: 100, payment_method: 'pix' }, key);
    expect(res1.status).toBe(201);
    expect((await res1.json()).payment?.id).toBeDefined();

    // Mesma chave, valor divergente → fingerprint mismatch → conflito.
    // A rota legada achata o envelope canônico para { error: "<message>" }
    // (sem `code`), mas preserva o status 409 do mapActionError('conflict').
    const res2 = await postPayment(BUDGET_MISMATCH, { amount: 120, payment_method: 'pix' }, key);
    expect(res2.status).toBe(409);
    expect((await res2.json()).error).toBeDefined();

    expect(await countPayments(BUDGET_MISMATCH)).toBe(1);
  });

  it('same key + mesmo valor + notes divergente → 409, nenhuma segunda linha', async () => {
    authAs(CLINIC);
    const key = `pay-idem-notes-${randomUUID()}`;

    const res1 = await postPayment(BUDGET_NOTES, { amount: 100, payment_method: 'pix', notes: 'parcela 1' }, key);
    expect(res1.status).toBe(201);
    expect((await res1.json()).payment?.id).toBeDefined();

    // notes faz parte do fingerprint → mismatch → conflito.
    const res2 = await postPayment(BUDGET_NOTES, { amount: 100, payment_method: 'pix', notes: 'parcela 2' }, key);
    expect(res2.status).toBe(409);
    expect((await res2.json()).error).toBeDefined();

    expect(await countPayments(BUDGET_NOTES)).toBe(1);
  });

  it('same key + chargeId divergente → 409, nenhuma segunda linha', async () => {
    // Via serviço (a rota legada achata chargeId): fingerprint inclui chargeId.
    const key = `pay-idem-charge-${randomUUID()}`;
    const first = await registerManualPayment({
      clinicId: CLINIC,
      budgetId: BUDGET_CHARGE,
      amount: 100,
      paymentMethod: 'pix',
      actorUserId: USER,
      idempotencyKey: key,
    });
    expect(first?.id).toBeDefined();

    // Mesma chave, demais campos iguais, chargeId divergente → fingerprint mismatch → conflito.
    await expect(
      registerManualPayment({
        clinicId: CLINIC,
        budgetId: BUDGET_CHARGE,
        chargeId: randomUUID(),
        amount: 100,
        paymentMethod: 'pix',
        actorUserId: USER,
        idempotencyKey: key,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });

    expect(await countPayments(BUDGET_CHARGE)).toBe(1);
  });

  it('same key + paidAt divergente → 409, nenhuma segunda linha', async () => {
    // Via serviço (a rota legada achata paidAt): fingerprint usa o input bruto de paidAt.
    const key = `pay-idem-paidat-${randomUUID()}`;
    const first = await registerManualPayment({
      clinicId: CLINIC,
      budgetId: BUDGET_PAIDAT,
      amount: 100,
      paymentMethod: 'pix',
      paidAt: '2026-10-01T10:00:00.000Z',
      actorUserId: USER,
      idempotencyKey: key,
    });
    expect(first?.id).toBeDefined();

    // Mesma chave, demais campos iguais, paidAt divergente → fingerprint mismatch → conflito.
    await expect(
      registerManualPayment({
        clinicId: CLINIC,
        budgetId: BUDGET_PAIDAT,
        amount: 100,
        paymentMethod: 'pix',
        paidAt: '2026-10-02T10:00:00.000Z',
        actorUserId: USER,
        idempotencyKey: key,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });

    expect(await countPayments(BUDGET_PAIDAT)).toBe(1);
  });

  it('double-click concorrente (Promise.allSettled, mesma chave) → exatamente 1 linha', async () => {
    authAs(CLINIC);
    const key = `pay-idem-race-${randomUUID()}`;
    const body = { amount: 100, payment_method: 'pix' };

    const [r1, r2] = await Promise.allSettled([
      postPayment(BUDGET_RACE, body, key),
      postPayment(BUDGET_RACE, body, key),
    ]);
    const responses = [r1, r2].map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean) as Response[];
    expect(responses).toHaveLength(2);
    // 201-com-original OU 409/422-em-processo — ambos aceitos; exige 1 linha só.
    for (const res of responses) {
      expect([201, 409, 422]).toContain(res.status);
    }
    expect(await countPayments(BUDGET_RACE)).toBe(1);
    if (responses[0].status === 201 && responses[1].status === 201) {
      const j1 = await responses[0].json();
      const j2 = await responses[1].json();
      expect(j2.payment?.id).toBe(j1.payment?.id);
    }
  });
});
