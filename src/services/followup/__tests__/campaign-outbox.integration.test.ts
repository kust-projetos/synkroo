import { Pool } from 'pg';
import { closeDb } from '@/lib/db/client';
import { enqueueRecipientDelivery, updateCampaignCounts } from '@/repositories/campaigns';

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

  it('marks fully failed campaigns failed and mixed outcomes partial', async () => {
    const failedCampaignId = '00000000-0000-0000-0000-00000000c101';
    const partialCampaignId = '00000000-0000-0000-0000-00000000c102';
    const failedPatientId = '00000000-0000-0000-0000-00000000c111';
    const partialSentPatientId = '00000000-0000-0000-0000-00000000c112';
    const partialFailedPatientId = '00000000-0000-0000-0000-00000000c113';

    await pool.query(`
      INSERT INTO patients (id, clinic_id, name, phone, email) VALUES
        ($1, $4, 'Failed Patient', '+5511999900011', 'failed-campaign@test.local'),
        ($2, $4, 'Partial Sent Patient', '+5511999900012', 'partial-sent@test.local'),
        ($3, $4, 'Partial Failed Patient', '+5511999900013', 'partial-failed@test.local')
      ON CONFLICT (id) DO NOTHING
    `, [failedPatientId, partialSentPatientId, partialFailedPatientId, clinicId]);
    await pool.query(`
      INSERT INTO campaigns (id, clinic_id, name, campaign_type, message_template, status, total_recipients) VALUES
        ($1, $3, 'All Failed', 'promotional', 'Test', 'running', 1),
        ($2, $3, 'Mixed Outcome', 'promotional', 'Test', 'running', 2)
      ON CONFLICT (id) DO UPDATE SET status = 'running', total_recipients = EXCLUDED.total_recipients
    `, [failedCampaignId, partialCampaignId, clinicId]);
    await pool.query('DELETE FROM campaign_recipients WHERE campaign_id IN ($1, $2)', [failedCampaignId, partialCampaignId]);
    await pool.query(`
      INSERT INTO campaign_recipients (campaign_id, patient_id, status, error_message) VALUES
        ($1, $3, 'failed', 'OUTBOX_DEAD_LETTER'),
        ($2, $4, 'delivered', NULL),
        ($2, $5, 'failed', 'OUTBOX_DEAD_LETTER')
    `, [failedCampaignId, partialCampaignId, failedPatientId, partialSentPatientId, partialFailedPatientId]);

    await updateCampaignCounts(failedCampaignId);
    await updateCampaignCounts(partialCampaignId);

    await expect(pool.query('SELECT status FROM campaigns WHERE id = $1', [failedCampaignId]))
      .resolves.toMatchObject({ rows: [{ status: 'failed' }] });
    await expect(pool.query('SELECT status FROM campaigns WHERE id = $1', [partialCampaignId]))
      .resolves.toMatchObject({ rows: [{ status: 'partial' }] });

    await pool.query('DELETE FROM campaigns WHERE id IN ($1, $2)', [failedCampaignId, partialCampaignId]);
    await pool.query('DELETE FROM patients WHERE id IN ($1, $2, $3)', [failedPatientId, partialSentPatientId, partialFailedPatientId]);
  });
});
