/**
 * Integration test: operacional waitlist actions & idempotent slot fill (F5.04).
 *
 * Flow: entrar waitlist → listar → obter → atualizar → preencher idempotente (FOR UPDATE) → concorrência → conflito 23P01 → cancelar.
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/operacional/actions/__tests__/waitlist
 *
 * Guard: skips all hooks/tests when RUN_INTEGRATION_TESTS is not set.
 */

/** @jest-environment node */

import { Pool } from 'pg';

const SKIP = process.env.RUN_INTEGRATION_TESTS !== '1';

// Bootstrap actions
import '@/modules/operacional/actions';
import { entrarWaitlist } from '../../entrar-waitlist';
import { listarWaitlist } from '../../listar-waitlist';
import { obterWaitlist } from '../../obter-waitlist';
import { atualizarWaitlist } from '../../atualizar-waitlist';
import { cancelarWaitlist } from '../../cancelar-waitlist';
import { preencherWaitlist } from '../../preencher-waitlist';
import { findWaitlistById } from '@/modules/operacional/repositories/waitlist-repository';

const CLINIC_ID = '00000000-0000-0000-0000-00000000000f';
const DENTIST_ID = '00000000-0000-0000-0000-00000000010f';
const DENTIST_ID_2 = '00000000-0000-0000-0000-00000000011f';
const PATIENT_ID = '00000000-0000-0000-0000-00000000020f';
const PATIENT_ID_2 = '00000000-0000-0000-0000-00000000021f';

let pool: Pool;

async function waitForSchemaReady(maxAttempts = 20, baseDelayMs = 500): Promise<Pool> {
  let lastError = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let p: Pool | undefined = undefined;
    try {
      p = new Pool({ connectionString: process.env.DATABASE_URL! });
      await p.query('SELECT 1');
      const tableRow = await p.query(`SELECT to_regclass('public.waitlist') AS tbl`);
      if (!tableRow.rows[0]?.tbl) throw new Error('waitlist table not found');
      return p;
    } catch (err: any) {
      lastError = err?.message ?? String(err);
      if (p) await p.end().catch(() => {});
      await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
    }
  }
  throw new Error(`Schema readiness timed out: ${lastError}`);
}

(SKIP ? describe.skip : describe)('Operacional Waitlist Integration (F5.04)', () => {
  const ctx = {
    userId: '00000000-0000-0000-0000-000000000001',
    clinicId: CLINIC_ID,
    role: 'admin',
    permissions: ['operacional:manage_waitlist', 'operacional:view', 'operacional:manage_appointments'],
  } as any;

  beforeAll(async () => {
    pool = await waitForSchemaReady();

    // Clean test data
    await pool.query('DELETE FROM appointment_reminders WHERE appointment_id IN (SELECT id FROM appointments WHERE clinic_id = $1)', [CLINIC_ID]);
    await pool.query('DELETE FROM waitlist WHERE clinic_id = $1', [CLINIC_ID]);
    await pool.query('DELETE FROM appointments WHERE clinic_id = $1', [CLINIC_ID]);
    await pool.query('DELETE FROM patients WHERE clinic_id = $1', [CLINIC_ID]);
    await pool.query('DELETE FROM dentists WHERE clinic_id = $1', [CLINIC_ID]);
    await pool.query('DELETE FROM clinics WHERE id = $1', [CLINIC_ID]);

    // Seed clinic
    await pool.query(
      `INSERT INTO clinics (id, name, created_at, updated_at)
       VALUES ($1, 'Waitlist Test Clinic', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
      [CLINIC_ID],
    );

    // Seed dentists
    await pool.query(
      `INSERT INTO dentists (id, clinic_id, name, created_at, updated_at)
       VALUES ($1, $2, 'Dr. Waitlist 1', NOW(), NOW()),
              ($3, $2, 'Dr. Waitlist 2', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [DENTIST_ID, CLINIC_ID, DENTIST_ID_2],
    );

    // Seed patients
    await pool.query(
      `INSERT INTO patients (id, clinic_id, name, phone, created_at, updated_at)
       VALUES ($1, $2, 'Patient WL 1', '11999990001', NOW(), NOW()),
              ($3, $2, 'Patient WL 2', '11999990002', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [PATIENT_ID, CLINIC_ID, PATIENT_ID_2],
    );
  });

  afterAll(async () => {
    if (pool) {
      await pool.query('DELETE FROM appointment_reminders WHERE appointment_id IN (SELECT id FROM appointments WHERE clinic_id = $1)', [CLINIC_ID]);
      await pool.query('DELETE FROM waitlist WHERE clinic_id = $1', [CLINIC_ID]);
      await pool.query('DELETE FROM appointments WHERE clinic_id = $1', [CLINIC_ID]);
      await pool.query('DELETE FROM patients WHERE clinic_id = $1', [CLINIC_ID]);
      await pool.query('DELETE FROM dentists WHERE clinic_id = $1', [CLINIC_ID]);
      await pool.query('DELETE FROM clinics WHERE id = $1', [CLINIC_ID]);
      await pool.end();
    }
  });

  it('1. performs CRUD on waitlist (entrar, listar, obter, atualizar, cancelar)', async () => {
    // Create
    const created = await entrarWaitlist.handler(
      {
        patientId: PATIENT_ID,
        dentistId: DENTIST_ID,
        preferredDate: '2026-11-20',
        preferredTimeStart: '09:00',
        preferredTimeEnd: '12:00',
        priority: 2,
        notes: 'Prefeência manhã',
      },
      ctx,
    );
    expect(created.id).toBeDefined();

    // List
    const list = await listarWaitlist.handler({ patientId: PATIENT_ID }, ctx);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].id).toBe(created.id);

    // Obter
    const fetched = await obterWaitlist.handler({ id: created.id }, ctx);
    expect(fetched.id).toBe(created.id);
    expect(fetched.priority).toBe(2);

    // Atualizar
    await atualizarWaitlist.handler({ id: created.id, priority: 5, notes: 'Urgência alterada' }, ctx);
    const updated = await obterWaitlist.handler({ id: created.id }, ctx);
    expect(updated.priority).toBe(5);
    expect(updated.notes).toBe('Urgência alterada');

    // Cancelar
    await cancelarWaitlist.handler({ id: created.id, reason: 'Desistência' }, ctx);
    const cancelled = await findWaitlistById(created.id);
    expect(cancelled?.status).toBe('cancelled');
  });

  it('2. fills slot idempotently with FOR UPDATE transaction', async () => {
    // Create fresh entry
    const created = await entrarWaitlist.handler(
      {
        patientId: PATIENT_ID_2,
        dentistId: DENTIST_ID,
        preferredDate: '2026-11-25',
        preferredTimeStart: '14:00',
        preferredTimeEnd: '16:00',
        priority: 3,
      },
      ctx,
    );

    const scheduledAt = new Date('2026-11-25T14:00:00Z');

    // First fill: creates appointment
    const fill1 = await preencherWaitlist.handler(
      {
        waitlistId: created.id,
        scheduledAt,
        durationMinutes: 30,
        dentistId: DENTIST_ID,
      },
      ctx,
    );

    expect(fill1.id).toBeDefined();
    expect(fill1.alreadyScheduled).toBe(false);

    // Verify DB state
    const entryAfter = await findWaitlistById(created.id);
    expect(entryAfter?.status).toBe('scheduled');
    expect(entryAfter?.scheduledAppointmentId).toBe(fill1.id);

    // Second fill (idempotent): returns same appointment without creating another
    const fill2 = await preencherWaitlist.handler(
      {
        waitlistId: created.id,
        scheduledAt,
        durationMinutes: 30,
        dentistId: DENTIST_ID,
      },
      ctx,
    );

    expect(fill2.id).toBe(fill1.id);
    expect(fill2.alreadyScheduled).toBe(true);

    // Verify appointment count in DB is exactly 1
    const { rows } = await pool.query(
      'SELECT count(*) FROM appointments WHERE clinic_id = $1 AND patient_id = $2',
      [CLINIC_ID, PATIENT_ID_2],
    );
    expect(parseInt(rows[0].count, 10)).toBe(1);
  });

  it('3. handles concurrent fill attempts on the same waitlist entry (FOR UPDATE locking)', async () => {
    // Create new entry
    const created = await entrarWaitlist.handler(
      {
        patientId: PATIENT_ID,
        dentistId: DENTIST_ID_2,
        preferredDate: '2026-11-26',
        preferredTimeStart: '10:00',
        priority: 4,
      },
      ctx,
    );

    const scheduledAt = new Date('2026-11-26T10:00:00Z');

    // Run 2 simultaneous fills in parallel
    const [resA, resB] = await Promise.allSettled([
      preencherWaitlist.handler({ waitlistId: created.id, scheduledAt, durationMinutes: 30, dentistId: DENTIST_ID_2 }, ctx),
      preencherWaitlist.handler({ waitlistId: created.id, scheduledAt, durationMinutes: 30, dentistId: DENTIST_ID_2 }, ctx),
    ]);

    expect(resA.status).toBe('fulfilled');
    expect(resB.status).toBe('fulfilled');

    const valA = (resA as PromiseFulfilledResult<any>).value;
    const valB = (resB as PromiseFulfilledResult<any>).value;

    // Both point to the exact same appointment ID
    expect(valA.id).toBe(valB.id);

    // Exactly one created it (alreadyScheduled: false) and one returned idempotent (alreadyScheduled: true)
    const scheduledFlags = [valA.alreadyScheduled, valB.alreadyScheduled].sort();
    expect(scheduledFlags).toEqual([false, true]);
  });

  it('4. rejects filling when waitlist is cancelled', async () => {
    const created = await entrarWaitlist.handler(
      {
        patientId: PATIENT_ID,
        preferredDate: '2026-11-27',
        preferredTimeStart: '08:00',
      },
      ctx,
    );

    await cancelarWaitlist.handler({ id: created.id }, ctx);

    await expect(
      preencherWaitlist.handler(
        {
          waitlistId: created.id,
          scheduledAt: new Date('2026-11-27T08:00:00Z'),
          durationMinutes: 30,
        },
        ctx,
      ),
    ).rejects.toThrow(/status 'cancelled'/i);
  });
});
