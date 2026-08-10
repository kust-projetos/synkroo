import { Pool } from 'pg';
import { closeDb } from '@/lib/db/client';
import { enqueueRecipientDelivery } from '@/repositories/campaigns';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
let clinicId: string
const prefix = `campaign-outbox:${process.pid}:${Date.now()}`;
let pool: Pool;

describeIntegration('campaign delivery outbox against PostgreSQL', () => {
  beforeAll(async () => { pool = new Pool({ connectionString: process.env.DATABASE_URL }); clinicId = (await pool.query('SELECT id FROM clinics LIMIT 1')).rows[0]?.id; if (!clinicId) throw new Error('integration fixture requires a clinic'); });
  afterEach(async () => { await pool.query('DELETE FROM outbox_jobs WHERE business_key LIKE $1', [`${prefix}%`]); });
  afterAll(async () => { await pool.end(); await closeDb(); });

  it('persists campaign delivery before any provider call', async () => {
    await enqueueRecipientDelivery({
      clinicId, campaignId: `${prefix}:campaign`, recipientId: `${prefix}:recipient`,
      patientId: '00000000-0000-0000-0000-000000000005', phone: '5511999999999', message: 'Teste',
    });
    await expect(pool.query('SELECT operation, payload->>\'phone\' AS phone FROM outbox_jobs WHERE clinic_id = $1 AND operation = $2 ORDER BY created_at DESC LIMIT 1', [clinicId, 'followup.campaign.recipient']))
      .resolves.toMatchObject({ rows: [{ operation: 'followup.campaign.recipient', phone: '5511999999999' }] });
  });
});
