/** @jest-environment node */
import { sql, eq, inArray } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import { dispatchChargeJob } from '../dispatch-charge-job';
import { registerGatewayProvider } from '@/modules/financeiro/gateways/registry';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const CLINIC_A = '00000000-0000-0000-0000-00000000a110';
const CLINIC_B = '00000000-0000-0000-0000-00000000b110';
const BUDGET_A = '00000000-0000-0000-0000-00000000c110';
const BUDGET_B = '00000000-0000-0000-0000-00000000c111';
const GATEWAY_A = '00000000-0000-0000-0000-00000000f110';
const GATEWAY_B = '00000000-0000-0000-0000-00000000f111';
const CHARGE_A = '00000000-0000-0000-0000-00000000d110';
const CHARGE_B = '00000000-0000-0000-0000-00000000d111';
const PATIENT_A = '00000000-0000-0000-0000-00000000e110';
const PATIENT_B = '00000000-0000-0000-0000-00000000e111';

const mockCreateCharge = jest.fn();
const mockCancelCharge = jest.fn();

beforeAll(async () => {
  // Register fake provider for integration test (overwrites any real)
  registerGatewayProvider('asaas' as any, {
    createCharge: mockCreateCharge,
    cancelCharge: mockCancelCharge,
    getCharge: jest.fn(),
    handleWebhook: jest.fn(),
  } as any);
});

beforeEach(() => {
  mockCreateCharge.mockReset().mockResolvedValue({
    externalChargeId: 'ext_integ_123',
    paymentUrl: 'https://pay.example/ext_integ_123',
    pixQrCode: 'pix_qr_integ',
    status: 'pending' as const,
  });
  mockCancelCharge.mockReset().mockResolvedValue({ cancelled: true });
});

describeOrSkip('dispatchChargeJob tenant isolation (DB real)', () => {
  beforeAll(async () => {
    const db = getDb();
    await db.execute(sql`INSERT INTO clinics (id, name, slug, phone, email) VALUES (${CLINIC_A}, 'Dispatch Clinic A', 'dispatch-a', '11999990010', 'a@dispatch.com') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO clinics (id, name, slug, phone, email) VALUES (${CLINIC_B}, 'Dispatch Clinic B', 'dispatch-b', '11999990011', 'b@dispatch.com') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO patients (id, clinic_id, name, phone) VALUES (${PATIENT_A}, ${CLINIC_A}, 'Patient A', '11999990010') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO patients (id, clinic_id, name, phone) VALUES (${PATIENT_B}, ${CLINIC_B}, 'Patient B', '11999990011') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO payment_gateways (id, clinic_id, provider, is_default, is_enabled) VALUES (${GATEWAY_A}, ${CLINIC_A}, 'asaas', true, true) ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO payment_gateways (id, clinic_id, provider, is_default, is_enabled) VALUES (${GATEWAY_B}, ${CLINIC_B}, 'asaas', true, true) ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO budgets (id, clinic_id, patient_id, title, total_value, final_value, status) VALUES (${BUDGET_A}, ${CLINIC_A}, ${PATIENT_A}, 'Budget A', '100.00', '100.00', 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO budgets (id, clinic_id, patient_id, title, total_value, final_value, status) VALUES (${BUDGET_B}, ${CLINIC_B}, ${PATIENT_B}, 'Budget B', '200.00', '200.00', 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO payment_charges (id, clinic_id, budget_id, gateway_id, due_date, amount, status) VALUES (${CHARGE_A}, ${CLINIC_A}, ${BUDGET_A}, ${GATEWAY_A}, '2026-08-20', '100.00', 'pending') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO payment_charges (id, clinic_id, budget_id, gateway_id, due_date, amount, status) VALUES (${CHARGE_B}, ${CLINIC_B}, ${BUDGET_B}, ${GATEWAY_B}, '2026-08-20', '200.00', 'pending') ON CONFLICT (id) DO NOTHING`);
  });

  afterAll(async () => {
    const db = getDb();
    try {
      await db.execute(sql`DELETE FROM payment_charges WHERE id IN (${CHARGE_A}, ${CHARGE_B})`);
      await db.execute(sql`DELETE FROM payment_gateways WHERE id IN (${GATEWAY_A}, ${GATEWAY_B})`);
      await db.execute(sql`DELETE FROM budgets WHERE id IN (${BUDGET_A}, ${BUDGET_B})`);
      await db.execute(sql`DELETE FROM patients WHERE id IN (${PATIENT_A}, ${PATIENT_B})`);
      await db.execute(sql`DELETE FROM clinics WHERE id IN (${CLINIC_A}, ${CLINIC_B})`);
    } finally {
      await closeDb();
    }
  });

  afterEach(async () => {
    // Reset charges to pending to keep tests independent
    const db = getDb();
    await db.execute(sql`UPDATE payment_charges SET status='pending', external_charge_id=NULL, payment_url=NULL, pix_qr_code=NULL WHERE id IN (${CHARGE_A}, ${CHARGE_B})`);
  });

  it('duas clínicas com gateways/charges distintos; execução de A não altera nenhuma linha de B (create)', async () => {
    const db = getDb();
    const beforeB = await db.execute(sql`SELECT id, clinic_id, status, external_charge_id FROM payment_charges WHERE id = ${CHARGE_B}`);
    const job: any = {
      id: 'job-integ-1',
      clinicId: CLINIC_A,
      operation: 'financeiro.charge.create',
      businessKey: 'charge:create:integ:A',
      payload: {
        chargeId: CHARGE_B, // vítima B
        gatewayId: GATEWAY_B,
        clinicId: CLINIC_B, // payload forjado — deve ser ignorado
        amount: 200,
        dueDate: '2026-08-20',
      },
      status: 'pending',
      attempts: 0,
    };

    await expect(dispatchChargeJob(job)).rejects.toThrow(/PAYMENT_CHARGE_NOT_FOUND|PAYMENT_GATEWAY_NOT_FOUND/);
    expect(mockCreateCharge).not.toHaveBeenCalled();

    const afterB = await db.execute(sql`SELECT id, clinic_id, status, external_charge_id FROM payment_charges WHERE id = ${CHARGE_B}`);
    expect(afterB.rows[0]).toEqual(beforeB.rows[0]);

    // B não foi tocado, A continua intacto também
    const afterA = await db.execute(sql`SELECT status FROM payment_charges WHERE id = ${CHARGE_A}`);
    expect(afterA.rows[0].status).toBe('pending');
  });

  it('fluxo feliz: job A com charge/gateway/budget de A chama provider e persiste via ForClinic', async () => {
    const db = getDb();
    const job: any = {
      id: 'job-integ-2',
      clinicId: CLINIC_A,
      operation: 'financeiro.charge.create',
      businessKey: 'charge:create:integ:A2',
      payload: {
        chargeId: CHARGE_A,
        gatewayId: GATEWAY_A,
        clinicId: CLINIC_A,
        amount: 100,
        dueDate: '2026-08-20',
      },
      status: 'pending',
      attempts: 0,
    };

    await expect(dispatchChargeJob(job)).resolves.toBeUndefined();
    expect(mockCreateCharge).toHaveBeenCalledWith(expect.objectContaining({ clinicId: CLINIC_A }));

    const afterA = await db.execute(sql`SELECT status, external_charge_id, payment_url FROM payment_charges WHERE id = ${CHARGE_A}`);
    expect(afterA.rows[0].status).toBe('pending');
    expect(afterA.rows[0].external_charge_id).toBe('ext_integ_123');
    expect(afterA.rows[0].payment_url).toBe('https://pay.example/ext_integ_123');

    // B não foi tocado
    const afterB = await db.execute(sql`SELECT status FROM payment_charges WHERE id = ${CHARGE_B}`);
    expect(afterB.rows[0].status).toBe('pending');
  });

  it('cancel cross-tenant falha fechado sem provider nem mutação vítima', async () => {
    const db = getDb();
    // Deixar charge B como cancellation_pending para test cancel path? Primeiro criar cancel job
    await db.execute(sql`UPDATE payment_charges SET status='cancellation_pending', external_charge_id='ext_b' WHERE id=${CHARGE_B}`);
    const beforeB = await db.execute(sql`SELECT status FROM payment_charges WHERE id=${CHARGE_B}`);

    const job: any = {
      id: 'job-integ-3',
      clinicId: CLINIC_A,
      operation: 'financeiro.charge.cancel',
      businessKey: 'charge:cancel:integ:A',
      payload: {
        chargeId: CHARGE_B,
        gatewayId: GATEWAY_B,
        clinicId: CLINIC_B,
        externalChargeId: 'ext_b',
      },
      status: 'pending',
      attempts: 0,
    };

    await expect(dispatchChargeJob(job)).rejects.toThrow();
    expect(mockCancelCharge).not.toHaveBeenCalled();
    const afterB = await db.execute(sql`SELECT status FROM payment_charges WHERE id=${CHARGE_B}`);
    expect(afterB.rows[0].status).toBe(beforeB.rows[0].status);
  });
});
