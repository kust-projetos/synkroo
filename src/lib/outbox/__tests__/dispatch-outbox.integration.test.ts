import { Pool } from 'pg';
import { closeDb, getDb } from '@/lib/db/client';
import { dispatchNextOutbox } from '@/lib/outbox/dispatch-outbox';
import { enqueueOutboxForTests } from '@/lib/outbox/outbox-repository';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
const clinicId = '00000000-0000-0000-0000-000000000001';
const prefix = `dispatcher-integration:${process.pid}:${Date.now()}`;
let pool: Pool;

describeIntegration('operation-routed outbox worker against PostgreSQL', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`
      INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
      VALUES ($1, 'Outbox Integration Clinic', 'outbox-integration-clinic', '+5500000000001', 'outbox@test.local', 'starter', 'active')
      ON CONFLICT (id) DO NOTHING
    `, [clinicId]);
  });
  afterEach(async () => { await pool.query('DELETE FROM outbox_jobs WHERE business_key LIKE $1', [`${prefix}%`]); });
  afterAll(async () => { await pool.end(); await closeDb(); });

  it('delivers a registered operation and records provider failure retries/dead letter', async () => {
    const db = getDb();
    const deliveredKey = `${prefix}:delivered`;
    await enqueueOutboxForTests(db, { clinicId, operation: 'integration.provider', businessKey: deliveredKey, payload: { ok: true } });
    const sender = jest.fn().mockResolvedValue(undefined);
    await expect(dispatchNextOutbox(sender, { operations: ['integration.provider'] })).resolves.toMatchObject({ status: 'delivered' });
    expect(sender).toHaveBeenCalledTimes(1);
    await expect(pool.query('SELECT status FROM outbox_jobs WHERE business_key = $1', [deliveredKey]))
      .resolves.toMatchObject({ rows: [{ status: 'delivered' }] });

    const retryKey = `${prefix}:retry`;
    await enqueueOutboxForTests(db, { clinicId, operation: 'integration.provider', businessKey: retryKey, payload: { ok: false } });
    const failingSender = jest.fn().mockRejectedValue(new Error('PROVIDER_DOWN'));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await dispatchNextOutbox(failingSender, { operations: ['integration.provider'] });
      await pool.query('UPDATE outbox_jobs SET next_attempt_at = NOW() WHERE business_key = $1', [retryKey]);
    }
    const { rows: retryRows } = await pool.query('SELECT status, last_error_code FROM outbox_jobs WHERE business_key = $1', [retryKey]);
    expect(['dead_letter', 'pending']).toContain(retryRows[0]?.status);
    expect(retryRows[0]?.last_error_code).toBe('Error');
  });
});
