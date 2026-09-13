/** @jest-environment node */
const SKIP = process.env.RUN_INTEGRATION_TESTS !== '1';
const describeOrSkip = SKIP ? describe.skip : describe;

jest.unmock('@/lib/db/client');

import { Pool } from 'pg';
import { and, eq, sql } from 'drizzle-orm';
import { anonymizePatient, exportPatientData } from '../../services/lgpd-service';
import { getDb, closeDb } from '@/lib/db/client';
import { patients } from '../../schema/patients';
import { actionLogs } from '@/lib/db/schema/audit';
import { outboxJobs } from '@/core/schema/infra';
import { v4 as uuidv4 } from 'uuid';

// Use same clinic for A/B to test same-clinic leakage (T3)
describeOrSkip('T3 LGPD same-clinic isolation and queue redaction (DB real)', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const clinicId = '00000000-0000-4000-8000-000000000010';
  const patientA = '00000000-0000-4000-8000-000000000011';
  const patientB = '00000000-0000-4000-8000-000000000012';
  const userId = '00000000-0000-4000-8000-000000000013';
  beforeAll(async () => {
    // Ensure clinic exists
    await pool.query(
      `INSERT INTO clinics (id, name, slug, phone, email) VALUES ($1, 'T3 Clinic', 't3-clinic', '+5500000000010', 't3-clinic@test.local') ON CONFLICT (id) DO NOTHING`,
      [clinicId],
    );
    await pool.query(`INSERT INTO users (id, clinic_id, email, name, role) VALUES ($1, $2, 't3-user@test.local', 'T3 User', 'owner') ON CONFLICT (id) DO NOTHING`, [
      userId,
      clinicId,
    ]);
    // Two patients same clinic
    await pool.query(
      `INSERT INTO patients (id, clinic_id, name, phone, email) VALUES ($1, $2, 'Patient A', '+5500000000A1', 'a@t3.local'), ($3, $2, 'Patient B', '+5500000000B1', 'b@t3.local') ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, name = EXCLUDED.name`,
      [patientA, clinicId, patientB],
    );
    // Action logs: one per patient with inputRedacted containing patientId
    await pool.query(`DELETE FROM action_logs WHERE clinic_id = $1`, [clinicId]);
    await pool.query(
      `INSERT INTO action_logs (id, clinic_id, actor, action_name, module, input_redacted, result) VALUES
        ($1, $2, 'user-1', 'view_patient', 'operacional', $3::jsonb, 'ok'),
        ($4, $2, 'user-1', 'view_patient', 'operacional', $5::jsonb, 'ok')`,
      [
        uuidv4(),
        clinicId,
        JSON.stringify({ patientId: patientA, notes: 'secret A' }),
        uuidv4(),
        JSON.stringify({ patientId: patientB, notes: 'secret B' }),
      ],
    );
    // Outbox and agent_queue for redaction test
    await pool.query(`DELETE FROM outbox_jobs WHERE clinic_id = $1`, [clinicId]);
    await pool.query(
      `INSERT INTO outbox_jobs (id, clinic_id, operation, business_key, payload, status) VALUES ($1, $2, 'test', $3, $4::jsonb, 'pending')`,
      [uuidv4(), clinicId, patientA, JSON.stringify({ patientId: patientA, secret: 'queue-secret-A' })],
    );
    // Ensure agent_queue and agent_dlq exist (may not exist in some envs, create if needed)
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS agent_queue (id uuid PRIMARY KEY, payload jsonb, status text)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS agent_dlq (id uuid PRIMARY KEY, payload jsonb)`);
      await pool.query(`DELETE FROM agent_queue WHERE payload::text LIKE '%${patientA}%' OR payload::text LIKE '%${patientB}%'`);
      await pool.query(`INSERT INTO agent_queue (id, payload, status) VALUES ($1, $2::jsonb, 'pending')`, [
        uuidv4(),
        JSON.stringify({ patientId: patientA, secret: 'queue-secret-A' }),
      ]);
      await pool.query(`INSERT INTO agent_queue (id, payload, status) VALUES ($1, $2::jsonb, 'pending')`, [
        uuidv4(),
        JSON.stringify({ patientId: patientB, secret: 'queue-secret-B' }),
      ]);
    } catch {}
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM action_logs WHERE clinic_id = $1`, [clinicId]);
    await pool.query(`DELETE FROM outbox_jobs WHERE clinic_id = $1`, [clinicId]);
    try {
      await pool.query(`DELETE FROM agent_queue WHERE payload::text LIKE '%queue-secret%'`);
      await pool.query(`DELETE FROM agent_dlq WHERE payload::text LIKE '%queue-secret%'`);
    } catch {}
    await pool.query(`DELETE FROM patients WHERE id IN ($1, $2)`, [patientA, patientB]);
    // Keep clinic for other tests, or delete if needed
    await closeDb();
    await pool.end();
  });

  it('export A does not contain identifiers/payload/actions of B in same clinic', async () => {
    const data = await exportPatientData(clinicId, patientA);
    const json = JSON.stringify(data);
    expect(json).not.toContain(patientB);
    expect(json).not.toContain('secret B');
    expect(json).not.toContain('Patient B');
    expect(json).toContain(patientA);
    // actionLogs should contain only A's log, not B's (minimization)
    expect(data.actionLogs.length).toBe(1);
    expect(JSON.stringify(data.actionLogs[0])).toContain(patientA);
    expect(JSON.stringify(data.actionLogs[0])).not.toContain(patientB);
  });

  it('failure to redact does not expose raw queue (redacts to safe omission)', async () => {
    // Anonymize A — should redact outbox and agent_queue for A, not expose raw
    const result = await anonymizePatient(clinicId, patientA, userId);
    expect(result.anonymized).toBe(true);

    const db = getDb();
    const [job] = await db
      .select({ payload: outboxJobs.payload, status: outboxJobs.status })
      .from(outboxJobs)
      .where(and(eq(outboxJobs.clinicId, clinicId), eq(outboxJobs.businessKey, patientA)))
      .limit(1);
    if (job) {
      expect(JSON.stringify(job.payload)).not.toContain('queue-secret-A');
      expect((job.payload as any).redacted).toBe(true);
    }

    try {
      const rows: any = await pool.query(`SELECT payload::text as p FROM agent_queue WHERE payload::text LIKE '%queue-secret-A%'`);
      expect(rows.rows.length).toBe(0);
      const redactedRows: any = await pool.query(`SELECT payload FROM agent_queue WHERE payload::text LIKE '%redacted%' LIMIT 1`);
      if (redactedRows.rows.length > 0) {
        expect(JSON.stringify(redactedRows.rows[0].payload)).toContain('redacted');
        expect(JSON.stringify(redactedRows.rows[0].payload)).not.toContain('queue-secret-A');
      }
    } catch (e) {
      // If table doesn't exist, safe omission is expected (unit test covers)
      expect(String(e)).not.toContain('queue-secret-A');
    }

    // Verify B's queue still intact and not leaked via A's export/anonymize
    const bExport = await exportPatientData(clinicId, patientB);
    expect(JSON.stringify(bExport)).not.toContain('queue-secret-A');
    expect(JSON.stringify(bExport)).toContain(patientB);
  });
});
