import { Pool } from 'pg';
import { closeDb } from '@/lib/db/client';
import { createPaymentChargeWithOutbox } from '../../repositories/financeiro-repository';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
let clinicId: string
let gatewayId: string
let budgetId: string
const prefix = `charge-outbox:${process.pid}:${Date.now()}`;
let pool: Pool;

describeIntegration('charge transactional outbox against PostgreSQL', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    clinicId = (await pool.query('SELECT id FROM clinics LIMIT 1')).rows[0]?.id;
    if (!clinicId) throw new Error('integration fixture requires a clinic');
    gatewayId = (await pool.query('SELECT id FROM payment_gateways WHERE clinic_id = $1 LIMIT 1', [clinicId])).rows[0]?.id;
    if (!gatewayId) gatewayId = (await pool.query('INSERT INTO payment_gateways (clinic_id, provider, is_default, is_enabled, masked_label) VALUES ($1, $2, true, true, $3) RETURNING id', [clinicId, 'asaas', 'integration'])).rows[0].id;
    budgetId = (await pool.query('INSERT INTO budgets (clinic_id, total_value, final_value, title, status) VALUES ($1, $2, $2, $3, $4) RETURNING id', [clinicId, '10.00', `${prefix}:budget`, 'pending'])).rows[0].id;
  });
  afterEach(async () => { await pool.query('DELETE FROM outbox_jobs WHERE business_key LIKE $1', [`${prefix}%`]); });
  afterAll(async () => { await pool.end(); await closeDb(); });

  it('persists the charge intent and external job in one transaction', async () => {
    const businessKey = `${prefix}:create`;
    const charge = await createPaymentChargeWithOutbox({
      clinicId, budgetId, gatewayId,
      dueDate: '2026-12-31', amount: '10.00', businessKey,
      payload: { clinicId, budgetId, gatewayId, amount: 10, dueDate: '2026-12-31' },
    });
    expect(charge.status).toBe('pending');
    await expect(pool.query('SELECT operation, payload->>\'chargeId\' AS charge_id FROM outbox_jobs WHERE business_key = $1', [businessKey]))
      .resolves.toMatchObject({ rows: [{ operation: 'financeiro.charge.create', charge_id: charge.id }] });
  });
});
