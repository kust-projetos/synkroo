/**
 * Integration test: appointments patient reassignment tenant scope.
 *
 * Proves the P0 invariant in PUT /api/appointments/[id] (atualizarConsulta):
 * reassigning an appointment to a patient from ANOTHER clinic returns 404
 * (not_found) and leaves the appointment untouched in the DB.
 *
 * Also pins the legacy snake_case behavior: `patient_id` is stripped silently
 * by the non-strict Zod input (success, patient unchanged), and a control case
 * shows same-clinic reassignment works.
 *
 * Auth/RBAC/manifest are mocked to simulate an authenticated CLINIC_A session
 * (mirrors tasks-scope); repositories hit the real Drizzle DB.
 * Each case uses its own appointment fixture so cases stay order-independent.
 *
 * Run via: npm run test:integration:run -- src/__tests__/api/appointments/patient-reassignment/integration.test.ts
 */

/** @jest-environment node */

jest.mock('@/lib/auth/session', () => ({ getUserProfile: jest.fn() }));

// Mock RBAC repository — Owner branch grants every non-master permission,
// including operacional:manage_appointments (proven pattern from conflict-detection.test.ts).
jest.mock('@/core/rbac/repository', () => ({
  drizzleRbacRepo: {
    getAccess: jest.fn().mockResolvedValue({
      isSystem: true,
      roleName: 'Owner',
      roleId: 'owner-role-id',
    }),
    getRolePermissions: jest.fn().mockResolvedValue([]),
    getOverrides: jest.fn().mockResolvedValue([]),
  },
}));

// Mock manifest so the withModuleRoute gate + buildUserContext resolve
// without depending on clinic_modules seed rows.
jest.mock('@/core/modules/manifest', () => {
  const actual = jest.requireActual('@/core/modules/manifest');
  return {
    ...actual,
    drizzleManifestRepo: {
      getEnabledModuleIds: jest.fn().mockResolvedValue(['core', 'operacional']),
    },
    createManifest: () => ({
      isEnabled: jest.fn().mockResolvedValue(true),
      enabledModules: jest.fn().mockResolvedValue(new Set(['core', 'operacional'])),
    }),
  };
});

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import { PUT } from '@/app/api/appointments/[id]/route';
import { getUserProfile } from '@/lib/auth/session';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const CLINIC_A = '00000000-0000-0000-0000-00000000a101';
const CLINIC_B = '00000000-0000-0000-0000-00000000b101';
const PATIENT_A1 = '00000000-0000-0000-0000-00000000a111';
const PATIENT_A2 = '00000000-0000-0000-0000-00000000a112';
const PATIENT_B = '00000000-0000-0000-0000-00000000b111';
const APPT_CROSS = '00000000-0000-0000-0000-00000000c111';
const APPT_SNAKE = '00000000-0000-0000-0000-00000000c112';
const APPT_VALID = '00000000-0000-0000-0000-00000000c113';

function authAs(clinicId: string) {
  (getUserProfile as jest.Mock).mockResolvedValue({
    id: 'user-owner-a',
    email: 'owner-a@test.local',
    name: 'Owner A',
    clinic_id: clinicId,
  });
}

function putRequest(appointmentId: string, body: Record<string, unknown>) {
  const req = new Request(`http://localhost/api/appointments/${appointmentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const ctx = { params: Promise.resolve({ id: appointmentId }) };
  return PUT(req as any, ctx as any);
}

/** Snapshot an appointment row for before/after comparison. */
async function snapshotAppointment(db: any, appointmentId: string) {
  const { rows } = await db.execute(
    sql`SELECT id, clinic_id as "clinicId", patient_id as "patientId", status FROM appointments WHERE id = ${appointmentId}`,
  );
  return rows[0] || null;
}

describeOrSkip('Appointments patient reassignment tenant scope — route + DB real', () => {
  beforeAll(async () => {
    const db = getDb();
    await db.execute(
      sql`INSERT INTO clinics (id, name, slug, phone, email)
          VALUES (${CLINIC_A}, 'Appt Reassign Clinic A', 'appt-reassign-a', '11999990101', 'reassign-a@test.com')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO clinics (id, name, slug, phone, email)
          VALUES (${CLINIC_B}, 'Appt Reassign Clinic B', 'appt-reassign-b', '11999990102', 'reassign-b@test.com')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO patients (id, clinic_id, name, phone)
          VALUES (${PATIENT_A1}, ${CLINIC_A}, 'Patient A1', '11999991101'),
                 (${PATIENT_A2}, ${CLINIC_A}, 'Patient A2', '11999991102'),
                 (${PATIENT_B}, ${CLINIC_B}, 'Patient B', '11999991103')
          ON CONFLICT (id) DO NOTHING`,
    );
    // One appointment per case, all in clinic A pointing at PATIENT_A1.
    // No dentist → no overlap-exclusion interaction; distinct times for hygiene.
    await db.execute(
      sql`INSERT INTO appointments (id, clinic_id, patient_id, scheduled_at, duration_minutes, status)
          VALUES (${APPT_CROSS}, ${CLINIC_A}, ${PATIENT_A1}, '2026-10-01T10:00:00Z', 30, 'scheduled'),
                 (${APPT_SNAKE}, ${CLINIC_A}, ${PATIENT_A1}, '2026-10-01T11:00:00Z', 30, 'scheduled'),
                 (${APPT_VALID}, ${CLINIC_A}, ${PATIENT_A1}, '2026-10-01T12:00:00Z', 30, 'scheduled')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM appointments WHERE id IN (${APPT_CROSS}, ${APPT_SNAKE}, ${APPT_VALID})`);
    await db.execute(sql`DELETE FROM patients WHERE id IN (${PATIENT_A1}, ${PATIENT_A2}, ${PATIENT_B})`);
    await db.execute(sql`DELETE FROM clinics WHERE id IN (${CLINIC_A}, ${CLINIC_B})`);
    await closeDb();
  });

  beforeEach(() => {
    (getUserProfile as jest.Mock).mockReset();
  });

  it('P0: PUT with patientId from another clinic returns 404 and leaves the appointment untouched', async () => {
    authAs(CLINIC_A);
    const db = getDb();

    const before = await snapshotAppointment(db, APPT_CROSS);
    expect(before).toBeDefined();
    expect(before.clinicId).toBe(CLINIC_A);
    expect(before.patientId).toBe(PATIENT_A1);

    const res = await putRequest(APPT_CROSS, { patientId: PATIENT_B });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: expect.objectContaining({ code: 'NOT_FOUND' }) });

    const after = await snapshotAppointment(db, APPT_CROSS);
    expect(after).toEqual(before);
  });

  it('legacy strip: PUT with snake_case patient_id ignores the key, succeeds, patient unchanged', async () => {
    authAs(CLINIC_A);
    const db = getDb();

    const before = await snapshotAppointment(db, APPT_SNAKE);
    expect(before).toBeDefined();
    expect(before.patientId).toBe(PATIENT_A1);

    const res = await putRequest(APPT_SNAKE, { patient_id: PATIENT_B });
    expect(res.status).toBe(200);

    const after = await snapshotAppointment(db, APPT_SNAKE);
    expect(after.patientId).toBe(PATIENT_A1);
    expect(after.status).toBe(before.status);
  });

  it('control: PUT with patientId from the same clinic reassigns the appointment', async () => {
    authAs(CLINIC_A);
    const db = getDb();

    const before = await snapshotAppointment(db, APPT_VALID);
    expect(before).toBeDefined();
    expect(before.patientId).toBe(PATIENT_A1);

    const res = await putRequest(APPT_VALID, { patientId: PATIENT_A2 });
    expect(res.status).toBe(200);

    const after = await snapshotAppointment(db, APPT_VALID);
    expect(after.patientId).toBe(PATIENT_A2);
    expect(after.clinicId).toBe(CLINIC_A);
  });
});
