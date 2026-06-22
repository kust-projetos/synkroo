/**
 * Integration test: appointments_no_overlap EXCLUDE constraint (F2a)
 *
 * Requires real Postgres with the constraint applied via migration.
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/operacional/repositories/__tests__/overbooking/integration.test.ts
 *
 * Prerequisites:
 *   - btree_gist extension enabled
 *   - appointments_no_overlap constraint exists on appointments table
 *   - Self-sufficient: seeds clinic, dentists, patient in beforeAll
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

// Waits for the DB to be fully ready after db:reset:
//   1. accepts connections  (SELECT 1)
//   2. appointments table exists  (to_regclass, safe before table creation)
//   3. appointments_no_overlap constraint exists  (proves migrations landed)
async function waitForSchemaReady(
  maxAttempts = 20,
  baseDelayMs = 500,
): Promise<Pool> {
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let p: Pool | undefined = undefined;
    try {
      p = new Pool({ connectionString: process.env.DATABASE_URL! });

      // 1. Socket readiness
      await p.query('SELECT 1');

      // 2. Table readiness — use to_regclass so it never throws on missing table
      const tableRow = await p.query(
        `SELECT to_regclass('public.appointments') AS tbl`,
      );
      if (!tableRow.rows[0]?.tbl) {
        throw new Error(`appointments table not found (attempt ${attempt}/${maxAttempts})`);
      }

      // 3. Constraint readiness — uses ::regclass only after table is confirmed
      const { rows } = await p.query(
        `SELECT conname FROM pg_constraint
         WHERE conrelid = 'appointments'::regclass
         AND conname = 'appointments_no_overlap'`,
      );

      if (rows.length > 0) {
        return p; // fully ready
      }

      lastError = `appointments_no_overlap constraint not yet applied (attempt ${attempt}/${maxAttempts})`;
    } catch (err: any) {
      lastError = err.message;
    }

    // Close any open pool before retrying
    try {
      // eslint-disable-next-line no-console
      console.warn(`Schema not ready (${attempt}/${maxAttempts}): ${lastError}`);
    } catch {
      // ignore
    }

    if (p) {
      await p.end().catch(() => null);
    }

    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
    }
  }

  throw new Error(`Schema not ready after ${maxAttempts} attempts: ${lastError}`);
}

beforeAll(async () => {
  pool = await waitForSchemaReady();

  pool.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Unexpected pool error:', err.message);
  });

  // Delete existing test data first (idempotent: handles any test execution order)
  await pool.query(`DELETE FROM appointments WHERE clinic_id = $1`, [CLINIC_ID]);
  await pool.query(`DELETE FROM patients WHERE id = $1`, [PATIENT_ID]);
  await pool.query(`DELETE FROM dentists WHERE id IN ($1, $2)`, [DENTIST_ID, DENTIST2_ID]);
  await pool.query(`DELETE FROM clinics WHERE id = $1`, [CLINIC_ID]);

  // Seed test clinic (required by dentists FK and patients FK)
  // Columns from src/lib/db/schema/core.ts: clinics table
  await pool.query(
    `INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
     VALUES ($1, 'Test Clinic F2a', 'test-clinic-f2a', '+5500000000000', 'clinic@test.local', 'starter', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [CLINIC_ID],
  );

  // Seed test dentist 1
  await pool.query(
    `INSERT INTO dentists (id, clinic_id, name, phone, email, cro)
     VALUES ($1, $2, 'Test Dentist F2a', '+5511000000001', 'dentist@test.local', 'SP-12345')
     ON CONFLICT (id) DO NOTHING`,
    [DENTIST_ID, CLINIC_ID],
  );

  // Seed test dentist 2
  await pool.query(
    `INSERT INTO dentists (id, clinic_id, name, phone, email, cro)
     VALUES ($1, $2, 'Test Dentist 2 F2a', '+5511000000002', 'dentist2@test.local', 'SP-54321')
     ON CONFLICT (id) DO NOTHING`,
    [DENTIST2_ID, CLINIC_ID],
  );

  // Seed test patient
  await pool.query(
    `INSERT INTO patients (id, clinic_id, name, phone, email)
     VALUES ($1, $2, 'Test Patient F2a', '+5511000000100', 'patient@test.local')
     ON CONFLICT (id) DO NOTHING`,
    [PATIENT_ID, CLINIC_ID],
  );
}, 60_000);

afterAll(async () => {
  if (!pool) return;
  try {
    await pool.query(`DELETE FROM appointments WHERE clinic_id = $1`, [CLINIC_ID]);
    await pool.query(`DELETE FROM patients WHERE id = $1`, [PATIENT_ID]);
    await pool.query(`DELETE FROM dentists WHERE id IN ($1, $2)`, [DENTIST_ID, DENTIST2_ID]);
    await pool.query(`DELETE FROM clinics WHERE id = $1`, [CLINIC_ID]);
  } catch {
    // cleanup errors are non-fatal
  } finally {
    await pool.end();
  }
});

// Insert an appointment using pool.query
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
  afterEach(async () => {
    if (!pool) return;
    try {
      await pool.query(`DELETE FROM appointments WHERE clinic_id = $1`, [CLINIC_ID]);
    } catch {
      // non-fatal
    }
  });

  it('should allow a single appointment insert', async () => {
    const id = await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID);
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('should block overlapping appointments for same dentist with 23P01', async () => {
    await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30);

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
    // Both try to insert overlapping windows for the same dentist.
    // PostgreSQL guarantees exactly one will be rejected with 23P01.
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

    expect(rejections.length).toBe(1);
    expect(successes.length).toBe(1);

    const rejected = rejections[0] as PromiseRejectedResult;
    const err = rejected.reason as any;
    expect(err.code).toBe('23P01');
    expect(err.constraint).toBe('appointments_no_overlap');
  });

  it('should allow non-overlapping appointments for same dentist', async () => {
    await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30);
    // Adjacent: 10:30-11:00 — no overlap with [) bounds
    const id = await insertViaPool('2026-07-01T10:30:00Z', DENTIST_ID, 30);
    expect(id).toBeDefined();
  });

  it('should allow overlapping appointments for different dentists', async () => {
    await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30);
    const id = await insertViaPool('2026-07-01T10:00:00Z', DENTIST2_ID, 30);
    expect(id).toBeDefined();
  });

  it('should allow overlapping cancelled appointments', async () => {
    await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30, 'cancelled');
    // Active overlapping should succeed — WHERE excludes cancelled
    const id = await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30);
    expect(id).toBeDefined();
  });

  it('should allow overlapping no_show appointments', async () => {
    await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30, 'no_show');
    // Active overlapping should succeed — WHERE excludes no_show
    const id = await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, 30);
    expect(id).toBeDefined();
  });

  it('should use default 30 minute duration when duration_minutes is NULL', async () => {
    await insertViaPool('2026-07-01T10:00:00Z', DENTIST_ID, null);
    // Try 10:15 — inside default 30min window → should fail
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
