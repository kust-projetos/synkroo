import { Pool } from 'pg';
import { processAsaasWebhook } from '../providers/asaas/webhook';
import { seedAuditTenants } from '@/__tests__/security/audit-remediation-fixtures';
import { closeDb } from '@/lib/db/client';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
const CLINIC_ID = '00000000-0000-4000-8000-000000000102';
const GATEWAY_ID = '00000000-0000-4000-8000-000000000502';
const BUDGET_ID = '00000000-0000-4000-8000-000000000702';
const CHARGE_ID = '00000000-0000-4000-8000-000000000802';
const EXTERNAL_CHARGE_ID = 'asaas-pay-802';
const EXTERNAL_EVENT_ID = 'asaas-event-802';

const payload = {
  id: EXTERNAL_EVENT_ID,
  event: 'PAYMENT_RECEIVED',
  payment: { id: EXTERNAL_CHARGE_ID, value: 250, status: 'RECEIVED' },
};

describeIntegration('Asaas webhook — PostgreSQL atomic replay', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await seedAuditTenants(pool);
    await pool.query(
      `INSERT INTO payment_gateways (id, clinic_id, provider, is_default, is_enabled, masked_label)
       VALUES ($1, $2, 'asaas', false, true, 'asaas-integration')
       ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, provider = EXCLUDED.provider,
         is_default = false, is_enabled = true`,
      [GATEWAY_ID, CLINIC_ID],
    );
    await pool.query(
      `INSERT INTO budgets (id, clinic_id, patient_id, title, total_value, final_value, status)
       VALUES ($1, $2, '00000000-0000-4000-8000-000000000301', 'Asaas integration', 250, 250, 'approved')
       ON CONFLICT (id) DO NOTHING`,
      [BUDGET_ID, CLINIC_ID],
    );
    await pool.query(
      `INSERT INTO payment_charges (id, clinic_id, budget_id, gateway_id, external_charge_id, due_date, amount, status)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 250, 'pending')
       ON CONFLICT (id) DO UPDATE SET external_charge_id = EXCLUDED.external_charge_id, status = 'pending'`,
      [CHARGE_ID, CLINIC_ID, BUDGET_ID, GATEWAY_ID, EXTERNAL_CHARGE_ID],
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM gateway_events WHERE external_event_id = $1', [EXTERNAL_EVENT_ID]);
    await pool.query('DELETE FROM payments WHERE charge_id = $1', [CHARGE_ID]);
    await pool.query('DELETE FROM payment_charges WHERE id = $1', [CHARGE_ID]);
    await pool.query('DELETE FROM budgets WHERE id = $1', [BUDGET_ID]);
    await pool.query('DELETE FROM payment_gateways WHERE id = $1', [GATEWAY_ID]);
    await pool.end();
    await closeDb();
  });

  it('settles exactly once under concurrent duplicate delivery', async () => {
    const results = await Promise.all([
      processAsaasWebhook({ clinicId: CLINIC_ID, headers: new Headers(), body: payload }),
      processAsaasWebhook({ clinicId: CLINIC_ID, headers: new Headers(), body: payload }),
    ]);

    expect(results.filter(result => result.settled)).toHaveLength(1);
    expect(results.filter(result => result.duplicate)).toHaveLength(1);
    const counts = await pool.query(
      `SELECT
         (SELECT count(*) FROM gateway_events WHERE external_event_id = $1) AS events,
         (SELECT count(*) FROM payments WHERE charge_id = $2) AS payments`,
      [EXTERNAL_EVENT_ID, CHARGE_ID],
    );
    expect(counts.rows[0]).toEqual({ events: '1', payments: '1' });
  });
});
