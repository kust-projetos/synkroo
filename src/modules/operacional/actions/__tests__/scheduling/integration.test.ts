/**
 * Integration test: operacional scheduling actions (F3).
 *
 * Flow: agendar → conflito (23P01) → confirmar → no-show
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/operacional/actions
 *
 * Prerequisites:
 *   - btree_gist extension + appointments_no_overlap constraint (F2a migration)
 *   - Self-sufficient: seeds clinic, dentists, patient in beforeAll
 *
 * Corrections per planner review:
 *   - Action names: operacional.agendarConsulta (dot notation, not colon)
 *   - Inputs: { id } not { appointmentId }
 *   - Output: { id } not { success }
 *   - Auth 401 test via mock buildUserContext
 *
 * Guard: skips all hooks/tests when RUN_INTEGRATION_TESTS is not set
 *        (prevents DB connection attempts during `npm test` without flag).
 */

/** @jest-environment node */

process.env.DATABASE_URL =
  'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

import { Pool } from 'pg';

// Skip entire suite when RUN_INTEGRATION_TESTS is not set — hooks run before describe.skip.
const SKIP = process.env.RUN_INTEGRATION_TESTS !== '1';

// Bootstrap actions (registers them)
import '@/modules/operacional/actions';
import { runAction } from '@/core/actions/run';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { agendarConsulta } from '../../agendar-consulta';
import { confirmarConsulta } from '../../confirmar-consulta';
import { registrarNoShow } from '../../registrar-no-show';
import { remarcarConsulta } from '../../remarcar-consulta';
import { getAction } from '@/core/actions/registry';
import * as contextModule from '@/core/actions/context';

const CLINIC_ID = '00000000-0000-0000-0000-00000000000f';
const DENTIST_ID = '00000000-0000-0000-0000-00000000010f';
const PATIENT_ID = '00000000-0000-0000-0000-00000000020f';

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
      const { rows } = await p.query(
        `SELECT conname FROM pg_constraint WHERE conrelid = 'appointments'::regclass AND conname = 'appointments_no_overlap'`,
      );
      if (rows.length > 0) return p;
      lastError = 'constraint not yet applied';
    } catch (err: any) { lastError = err.message; }
    try { await p?.end(); } catch { /* ignore */ }
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
  }
  throw new Error(`Schema not ready: ${lastError}`);
}

// ─── Auth context for tests ───────────────────────────────────────────────────

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

  // Ensure clinic exists — delete first to handle cross-test pollution
  await pool.query(`DELETE FROM clinics WHERE id = $1`, [CLINIC_ID]);
  await pool.query(
    `INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
     VALUES ($1, 'Test Clinic F3', 'test-clinic-f3', '+5500000000000', 'clinic@test.local', 'starter', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [CLINIC_ID],
  );

  // Seed dentist (delete first for idempotency)
  await pool.query(`DELETE FROM dentists WHERE id = $1`, [DENTIST_ID]);
  await pool.query(
    `INSERT INTO dentists (id, clinic_id, name, phone, email, cro)
     VALUES ($1, $2, 'Test Dentist F3', '+5511000000001', 'dentist@test.local', 'SP-12345')
     ON CONFLICT (id) DO NOTHING`,
    [DENTIST_ID, CLINIC_ID],
  );

  // Seed patient
  await pool.query(`DELETE FROM patients WHERE id = $1`, [PATIENT_ID]);
  await pool.query(
    `INSERT INTO patients (id, clinic_id, name, phone, email)
     VALUES ($1, $2, 'Test Patient F3', '+5511000000100', 'patient@test.local')
     ON CONFLICT (id) DO NOTHING`,
    [PATIENT_ID, CLINIC_ID],
  );
}, 60_000);

afterAll(async () => {
  if (SKIP || !pool) return;
  try {
    await pool.query(`DELETE FROM appointments WHERE clinic_id = $1`, [CLINIC_ID]);
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

describeOrSkip('operacional scheduling actions (F3)', () => {
  it('agendarConsulta: should create appointment and return id', async () => {
    const result = await runAction(agendarConsulta, {
      patientId: PATIENT_ID,
      dentistId: DENTIST_ID,
      scheduledAt: '2026-08-01T10:00:00Z',
      durationMinutes: 30,
    }, makeCtx());

    if (!result.ok) throw new Error(`agendarConsulta failed: ${result.error.code} — ${result.error.message}`);
    expect(result.ok).toBe(true);
    expect((result as any).data.id).toBeDefined();
    const id = (result as any).data.id;

    const { rows } = await pool.query(`SELECT id, status FROM appointments WHERE id = $1`, [id]);
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('scheduled');
  });

  it('agendarConsulta: should reject conflict 23P01 → conflict error', async () => {
    // First: 10:00-10:30
    const first = await runAction(agendarConsulta, {
      patientId: PATIENT_ID,
      dentistId: DENTIST_ID,
      scheduledAt: '2026-08-01T10:00:00Z',
      durationMinutes: 30,
    }, makeCtx());
    expect(first.ok).toBe(true);
    const firstId = (first as any).data.id;

    // Overlapping: 10:15-10:45
    const second = await runAction(agendarConsulta, {
      patientId: PATIENT_ID,
      dentistId: DENTIST_ID,
      scheduledAt: '2026-08-01T10:15:00Z',
      durationMinutes: 30,
    }, makeCtx());

    expect(second.ok).toBe(false);
    expect((second as any).error.code).toBe('conflict');
    expect((second as any).error.message).toContain('Horário indisponível');

    await pool.query(`DELETE FROM appointments WHERE id = $1`, [firstId]);
  });

  it('confirmarConsulta: should confirm scheduled appointment', async () => {
    const appt = await runAction(agendarConsulta, {
      patientId: PATIENT_ID,
      dentistId: DENTIST_ID,
      scheduledAt: '2026-08-01T14:00:00Z',
    }, makeCtx());
    if (!appt.ok) throw new Error(`setup failed: ${appt.error.code}`);
    const id = (appt as any).data.id;

    // Input: { id } (dot-notation plan)
    const result = await runAction(confirmarConsulta, { id }, makeCtx());
    expect(result.ok).toBe(true);
    // Output: { id } per plan
    expect((result as any).data.id).toBe(id);

    const { rows } = await pool.query(`SELECT status FROM appointments WHERE id = $1`, [id]);
    expect(rows[0].status).toBe('confirmed');
  });

  it('registrarNoShow: should mark confirmed appointment as no_show', async () => {
    const appt = await runAction(agendarConsulta, {
      patientId: PATIENT_ID,
      dentistId: DENTIST_ID,
      scheduledAt: '2026-08-01T15:00:00Z',
    }, makeCtx());
    if (!appt.ok) throw new Error(`setup failed: ${appt.error.code}`);
    const id = (appt as any).data.id;

    await runAction(confirmarConsulta, { id }, makeCtx());

    // Input: { id } (dot-notation plan)
    const result = await runAction(registrarNoShow, { id }, makeCtx());
    expect(result.ok).toBe(true);
    expect((result as any).data.id).toBe(id);

    const { rows } = await pool.query(`SELECT status FROM appointments WHERE id = $1`, [id]);
    expect(rows[0].status).toBe('no_show');
  });

  it('remarcarConsulta: should reschedule to new slot', async () => {
    const appt = await runAction(agendarConsulta, {
      patientId: PATIENT_ID,
      dentistId: DENTIST_ID,
      scheduledAt: '2026-08-01T16:00:00Z',
    }, makeCtx());
    if (!appt.ok) throw new Error(`setup failed: ${appt.error.code}`);
    const id = (appt as any).data.id;

    // Input: { id, scheduledAt } (dot-notation plan)
    const result = await runAction(remarcarConsulta, {
      id,
      scheduledAt: '2026-08-01T17:00:00Z',
    }, makeCtx());

    expect(result.ok).toBe(true);
    expect((result as any).data.id).toBe(id);

    const { rows } = await pool.query(`SELECT scheduled_at FROM appointments WHERE id = $1`, [id]);
    const scheduledAt = new Date(rows[0].scheduled_at);
    expect(scheduledAt.toISOString()).toContain('2026-08-01T17:');
  });

  it('remarcarConsulta: should reject conflict 23P01 → conflict error', async () => {
    const appt1 = await runAction(agendarConsulta, {
      patientId: PATIENT_ID,
      dentistId: DENTIST_ID,
      scheduledAt: '2026-08-01T11:00:00Z',
    }, makeCtx());
    if (!appt1.ok) throw new Error(`setup1 failed: ${appt1.error.code}`);
    const id1 = (appt1 as any).data.id;

    const appt2 = await runAction(agendarConsulta, {
      patientId: PATIENT_ID,
      dentistId: DENTIST_ID,
      scheduledAt: '2026-08-01T12:00:00Z',
    }, makeCtx());
    if (!appt2.ok) throw new Error(`setup2 failed: ${appt2.error.code}`);
    const id2 = (appt2 as any).data.id;

    // Reschedule appt1 → appt2's slot → should fail
    const result = await runAction(remarcarConsulta, {
      id: id1,
      scheduledAt: '2026-08-01T12:00:00Z',
    }, makeCtx());

    expect(result.ok).toBe(false);
    expect((result as any).error.code).toBe('conflict');

    await pool.query(`DELETE FROM appointments WHERE id IN ($1, $2)`, [id1, id2]);
  });

  it('action registered with dot-notation name', async () => {
    const action = getAction('operacional.agendarConsulta');
    expect(action).toBeDefined();
    expect(action!.name).toBe('operacional.agendarConsulta');
    expect(action!.module).toBe('operacional');
    expect(action!.requires).toBe('operacional:manage_appointments');
  });

  it('route adapter: unauthenticated → 401 (not 500)', async () => {
    // Mock buildUserContext to throw unauthenticated
    const original = (contextModule as any).buildUserContext;
    jest.spyOn(contextModule, 'buildUserContext').mockRejectedValue(new Error('unauthenticated'));

    const response = await runActionRoute(confirmarConsulta, { id: 'not-a-uuid' });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');

    jest.spyOn(contextModule, 'buildUserContext').mockRestore();
    if (original) (contextModule as any).buildUserContext = original;
  });
});
