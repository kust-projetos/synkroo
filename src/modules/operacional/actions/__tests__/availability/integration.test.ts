/**
 * Integration test: operacional availability action (F2b / Task 4).
 *
 * Flow: seed schedule_blocks → create booked appointment
 *       → consultarDisponibilidade → booked slot absent, free slots present
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/operacional/actions/__tests__/availability
 *
 * Prerequisites:
 *   - Self-sufficient: seeds clinic, dentist, schedule_block, patient
 *   - Uses isolated UUIDs (different from scheduling test)
 *
 * Guard: skips all hooks/tests when RUN_INTEGRATION_TESTS is not set.
 */

/** @jest-environment node */

import { Pool } from 'pg';

// Skip entire suite when RUN_INTEGRATION_TESTS is not set — hooks run before describe.skip.
const SKIP = process.env.RUN_INTEGRATION_TESTS !== '1';

// Bootstrap actions
import '@/modules/operacional/actions';
import { runAction } from '@/core/actions/run';
import { consultarDisponibilidade } from '../../consultar-disponibilidade';
import { getAction } from '@/core/actions/registry';

const CLINIC_ID = '00000000-0000-0000-0000-0000000000f1';
const DENTIST_ID = '00000000-0000-0000-0000-0000000001f1';
const PATIENT_ID = '00000000-0000-0000-0000-0000000002f1';

const TEST_DATE = '2026-08-03'; // Monday (dayOfWeek = 1 in UTC)
const BLOCK_START = '08:00:00';
const BLOCK_END = '18:00:00';

// 10:00 UTC = 07:00 Brasília (no DST in Aug) = 10:00 local
const BOOKED_SLOT = '2026-08-03T10:00:00.000Z';

let pool: Pool;

// ─── WaitForSchemaReady ───────────────────────────────────────────────────────

async function waitForSchemaReady(maxAttempts = 20, baseDelayMs = 500): Promise<Pool> {
  let lastError = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let p: Pool | undefined = undefined;
    try {
      p = new Pool({ connectionString: process.env.DATABASE_URL! });
      await p.query('SELECT 1');
      const tableRow = await p.query(`SELECT to_regclass('public.appointments') AS tbl`);
      if (!tableRow.rows[0]?.tbl) throw new Error('table not found');
      const blockRow = await p.query(`SELECT to_regclass('public.schedule_blocks') AS tbl`);
      if (!blockRow.rows[0]?.tbl) throw new Error('schedule_blocks not found');
      return p;
    } catch (err: any) { lastError = err.message; }
    try { await p?.end(); } catch { /* ignore */ }
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
  }
  throw new Error(`Schema not ready: ${lastError}`);
}

// ─── Auth context ────────────────────────────────────────────────────────────

function makeCtx(clinicId = CLINIC_ID) {
  return {
    source: 'user' as const,
    user: { id: '00000000-0000-0000-0000-000000000001', email: 'test@test.local', name: 'Test User', role: 'admin' },
    clinicId,
    role: 'admin',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'test-user' },
  };
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  if (SKIP) return;
  pool = await waitForSchemaReady();

  // Clean slate
  await pool.query(`DELETE FROM appointments WHERE clinic_id = $1`, [CLINIC_ID]);
  await pool.query(`DELETE FROM schedule_blocks WHERE clinic_id = $1`, [CLINIC_ID]);
  await pool.query(`DELETE FROM patients WHERE id = $1`, [PATIENT_ID]);
  await pool.query(`DELETE FROM dentists WHERE id = $1`, [DENTIST_ID]);
  await pool.query(`DELETE FROM clinics WHERE id = $1`, [CLINIC_ID]);

  // Seed clinic
  await pool.query(
    `INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
     VALUES ($1, 'Test Clinic F2b', 'test-clinic-f2b', '+5500000000000', 'clinic-f2b@test.local', 'starter', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [CLINIC_ID],
  );

  // Seed dentist
  await pool.query(
    `INSERT INTO dentists (id, clinic_id, name, phone, email, cro)
     VALUES ($1, $2, 'Test Dentist F2b', '+5511000000f1', 'dentist-f2b@test.local', 'SP-F2B00')
     ON CONFLICT (id) DO NOTHING`,
    [DENTIST_ID, CLINIC_ID],
  );

  // Seed patient
  await pool.query(
    `INSERT INTO patients (id, clinic_id, name, phone, email)
     VALUES ($1, $2, 'Test Patient F2b', '+551100000ff1', 'patient-f2b@test.local')
     ON CONFLICT (id) DO NOTHING`,
    [PATIENT_ID, CLINIC_ID],
  );

  // Seed schedule block: Monday 08:00–18:00
  await pool.query(
    `INSERT INTO schedule_blocks (id, clinic_id, dentist_id, day_of_week, start_time, end_time, is_available)
     VALUES ('00000000-0000-0000-0000-000000000bf1', $1, $2, 1, $3::time, $4::time, true)
     ON CONFLICT (id) DO NOTHING`,
    [CLINIC_ID, DENTIST_ID, BLOCK_START, BLOCK_END],
  );
}, 60_000);

afterAll(async () => {
  if (SKIP || !pool) return;
  try {
    await pool.query(`DELETE FROM appointments WHERE clinic_id = $1`, [CLINIC_ID]);
    await pool.query(`DELETE FROM schedule_blocks WHERE clinic_id = $1`, [CLINIC_ID]);
    await pool.query(`DELETE FROM patients WHERE id = $1`, [PATIENT_ID]);
    await pool.query(`DELETE FROM dentists WHERE id = $1`, [DENTIST_ID]);
    await pool.query(`DELETE FROM clinics WHERE id = $1`, [CLINIC_ID]);
  } catch { /* ignore */ }
  await pool.end();
});

afterEach(async () => {
  if (SKIP || !pool) return;
  try {
    await pool.query(`DELETE FROM appointments WHERE clinic_id = $1`, [CLINIC_ID]);
  } catch { /* ignore */ }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

const describeOrSkip = SKIP ? describe.skip : describe;

describeOrSkip('operacional availability action (F2b)', () => {
  it('should return free slots excluding booked appointment', async () => {
    // Book a slot at 10:00
    await pool.query(
      `INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
       VALUES ($1, $2, $3, $4::timestamptz, 30, 'scheduled')`,
      [CLINIC_ID, PATIENT_ID, DENTIST_ID, BOOKED_SLOT],
    );

    const result = await runAction(consultarDisponibilidade, {
      dentistId: DENTIST_ID,
      date: TEST_DATE,
    }, makeCtx());

    expect(result.ok).toBe(true);
    const slots = (result as any).data as string[];

    // The 10:00-10:30 slot must NOT appear
    const bookedSlotISO = new Date(BOOKED_SLOT).toISOString();
    const overlappingSlots = slots.filter((s: string) => {
      const slotStart = new Date(s).getTime();
      const slotEnd = slotStart + 30 * 60 * 1000;
      const apptStart = new Date(BOOKED_SLOT).getTime();
      const apptEnd = apptStart + 30 * 60 * 1000;
      return slotStart < apptEnd && slotEnd > apptStart;
    });
    expect(overlappingSlots).toHaveLength(0);

    // Adjacent free slots must appear (e.g. 09:30 and 10:30)
    const has09_30 = slots.some((s: string) => s.includes('T09:30'));
    const has10_30 = slots.some((s: string) => s.includes('T10:30'));
    expect(has09_30).toBe(true);
    expect(has10_30).toBe(true);
  });

  it('should return all block slots when no appointments exist', async () => {
    const result = await runAction(consultarDisponibilidade, {
      dentistId: DENTIST_ID,
      date: TEST_DATE,
    }, makeCtx());

    expect(result.ok).toBe(true);
    const slots = (result as any).data as string[];

    // Should have 08:00 and 08:30 at minimum
    expect(slots.length).toBeGreaterThan(0);
    const has08_00 = slots.some((s: string) => s.includes('T08:00'));
    expect(has08_00).toBe(true);
  });

  it('should return empty array when no schedule blocks exist', async () => {
    // Remove the schedule block
    await pool.query(`DELETE FROM schedule_blocks WHERE clinic_id = $1`, [CLINIC_ID]);

    const result = await runAction(consultarDisponibilidade, {
      dentistId: DENTIST_ID,
      date: TEST_DATE,
    }, makeCtx());

    expect(result.ok).toBe(true);
    const slots = (result as any).data as string[];
    expect(slots).toHaveLength(0);
  });

  it('operacional.consultarDisponibilidade registered correctly', async () => {
    const action = getAction('operacional.consultarDisponibilidade');
    expect(action).toBeDefined();
    expect(action!.name).toBe('operacional.consultarDisponibilidade');
    expect(action!.module).toBe('operacional');
    expect(action!.requires).toBe('operacional:view');
  });
});
