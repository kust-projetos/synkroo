/**
 * Integration test: appointments_no_overlap EXCLUDE constraint (F2a)
 *
 * Requires real Postgres with the constraint applied via migration.
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/operacional/repositories/__tests__/overbooking/integration.test.ts
 *
 * Prerequisites:
 *   - btree_gist extension enabled
 *   - appointments_no_overlap constraint exists on appointments table
 *   - Test clinic seeded (scripts/seed-test-clinic.mjs)
 */

/** @jest-environment node */

process.env.DATABASE_URL =
  'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

import { Pool } from 'pg';

const CLINIC_ID = '00000000-0000-0000-0000-000000000001';
const DENTIST_ID = '00000000-0000-0000-0000-000000000101';
const DENTIST2_ID = '00000000-0000-0000-0000-000000000102';
const PATIENT_ID = '00000000-0000-0000-0000-000000000201';

let pool: Pool;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  // Verify constraint exists
  const { rows } = await client.query(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = 'appointments'::regclass
     AND conname = 'appointments_no_overlap'`,
  );
  if (rows.length === 0) {
    client.release();
    throw new Error(
      'appointments_no_overlap constraint not found. Run migration first: npm run db:migrate',
    );
  }

  // Seed test dentist 1
  await client.query(
    `INSERT INTO dentists (id, clinic_id, name, phone, email, cro)
     VALUES ($1, $2, 'Test Dentist', '+5511000000001', 'dentist@test.local', 'SP-12345')
     ON CONFLICT (id) DO NOTHING`,
    [DENTIST_ID, CLINIC_ID],
  );

  // Seed test dentist 2
  await client.query(
    `INSERT INTO dentists (id, clinic_id, name, phone, email, cro)
     VALUES ($1, $2, 'Test Dentist 2', '+5511000000002', 'dentist2@test.local', 'SP-54321')
     ON CONFLICT (id) DO NOTHING`,
    [DENTIST2_ID, CLINIC_ID],
  );

  // Seed test patient
  await client.query(
    `INSERT INTO patients (id, clinic_id, name, phone, email)
     VALUES ($1, $2, 'Test Patient', '+5511000000100', 'patient@test.local')
     ON CONFLICT (id) DO NOTHING`,
    [PATIENT_ID, CLINIC_ID],
  );

  client.release();
});

afterAll(async () => {
  // Clean up via pool — each query gets its own connection from pool
  await pool.query(`DELETE FROM appointments WHERE clinic_id = $1`, [CLINIC_ID]);
  await pool.query(`DELETE FROM patients WHERE id = $1`, [PATIENT_ID]);
  await pool.query(`DELETE FROM dentists WHERE id IN ($1, $2)`, [DENTIST_ID, DENTIST2_ID]);
  await pool.end();
});

// Insert an appointment using a pool connection (pool assigns available connection per query)
async function insertViaPool(
  scheduledAt: string,
  dentistId: string,
  durationMinutes: number | null = 30,
  status = 'scheduled',
): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, 'F2a integration test')
     RETURNING id`,
    [CLINIC_ID, PATIENT_ID, dentistId, scheduledAt, durationMinutes, status],
  );
  return rows[0].id;
}

describe('appointments_no_overlap constraint (F2a)', () => {
  // Clean appointments between tests via pool (pool handles connection reuse)
  afterEach(async () => {
    await pool.query(`DELETE FROM appointments WHERE clinic_id = $1`, [CLINIC_ID]);
  });

  it('should allow a single appointment insert', async () => {
    const id = await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID);
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('should block overlapping appointments for same dentist with 23P01', async () => {
    // First: 10:00-10:30
    await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30);

    // Overlapping: 10:15-10:45
    const err = await pool
      .query(
        `INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'F2a overlap test')
         RETURNING id`,
        [CLINIC_ID, PATIENT_ID, DENTIST_ID, '2026-07-01T10:15:00Z', 30, 'scheduled'],
      )
      .then(() => null)
      .catch((e: any) => e);

    expect(err).not.toBeNull();
    expect(err.code).toBe('23P01');
    expect(err.constraint).toBe('appointments_no_overlap');
  });

  it('should allow concurrent overlapping inserts — one succeeds, one fails 23P01', async () => {
    // Both try to insert at 10:00-10:30 for the same dentist — one must win.
    // The constraint guarantees exactly 1 reject with 23P01.
    const [result1, result2] = await Promise.allSettled([
      pool.query(
        `INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'F2a concurrent test a')
         RETURNING id`,
        [CLINIC_ID, PATIENT_ID, DENTIST_ID, '2026-07-01T11:00:00Z', 30, 'scheduled'],
      ),
      pool.query(
        `INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'F2a concurrent test b')
         RETURNING id`,
        [CLINIC_ID, PATIENT_ID, DENTIST_ID, '2026-07-01T11:15:00Z', 30, 'scheduled'],
      ),
    ]);

    const rejections = [result1, result2].filter((r) => r.status === 'rejected');
    const successes = [result1, result2].filter((r) => r.status === 'fulfilled');

    // Exactly one must be rejected (the overlapping one) and one fulfilled
    expect(rejections.length).toBe(1);
    expect(successes.length).toBe(1);

    // The rejection must be the exclusion_violation error
    const rejected = rejections[0] as PromiseRejectedResult;
    const err = rejected.reason as any;
    expect(err.code).toBe('23P01');
    expect(err.constraint).toBe('appointments_no_overlap');
  });

  it('should allow non-overlapping appointments for same dentist', async () => {
    // First: 10:00-10:30
    await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30);

    // Adjacent: 10:30-11:00 → no overlap with [) bounds
    const id = await insertViaPool('2026-07-01T10:30:00Z', DENTIST_ID, 30);
    expect(id).toBeDefined();
  });

  it('should allow overlapping appointments for different dentists', async () => {
    // Dentist 1: 10:00-10:30
    await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30);

    // Dentist 2, same time: should succeed
    const id = await insertViaPool('2026-07-01T10:00:00Z', DENTIST2_ID, 30);
    expect(id).toBeDefined();
  });

  it('should allow overlapping cancelled appointments', async () => {
    // Cancelled: 10:00-10:30
    await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30, 'cancelled');

    // Active overlapping: should succeed (WHERE excludes cancelled)
    const id = await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30);
    expect(id).toBeDefined();
  });

  it('should allow overlapping no_show appointments', async () => {
    // no_show: 10:00-10:30
    await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30, 'no_show');

    // Active overlapping: should succeed (WHERE excludes no_show)
    const id = await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30);
    expect(id).toBeDefined();
  });

  it('should use default 30 minute duration when duration_minutes is NULL', async () => {
    // NULL duration → defaults to 30min: 10:00-10:30
    await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, null);

    // Try 10:15 (inside default window) → should fail
    const err = await pool
      .query(
        `INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'F2a null duration test')
         RETURNING id`,
        [CLINIC_ID, PATIENT_ID, DENTIST_ID, '2026-07-01T10:15:00Z', 30, 'scheduled'],
      )
      .then(() => null)
      .catch((e: any) => e);

    expect(err).not.toBeNull();
    expect(err.code).toBe('23P01');
    expect(err.constraint).toBe('appointments_no_overlap');
  });
});
