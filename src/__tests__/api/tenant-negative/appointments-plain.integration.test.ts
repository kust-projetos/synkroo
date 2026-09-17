/**
 * Integration test: appointments GET/DELETE plain cross-tenant (Etapa 3).
 *
 * Lacuna confirmada antes de escrever: patient-reassignment cobre o PUT com
 * reassignment cross-tenant; appointment-relational-tenancy cobre o PUT em
 * nível de action (mocks). Faltava, em nível de rota + DB real:
 *   GET /api/appointments/[id]    → 404 NOT_FOUND opaco, sem vazamento, DB intacto
 *   PUT /api/appointments/[id]    → 404 NOT_FOUND opaco (id próprio estrangeiro), DB intacto
 *   DELETE /api/appointments/[id] → 404 NOT_FOUND opaco (não cancela), status intacto
 *
 * Auth/RBAC/manifest mockados (padrão patient-reassignment); rota + DB reais.
 *
 * Run via: npm run test:integration:run -- src/__tests__/api/tenant-negative/appointments-plain.integration.test.ts
 */

/** @jest-environment node */

jest.mock('@/lib/auth/session', () => ({ getUserProfile: jest.fn() }));

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

jest.mock('@/core/modules/manifest', () => {
  const actual = jest.requireActual('@/core/modules/manifest');
  return {
    ...actual,
    drizzleManifestRepo: {
      getEnabledModuleIds: jest.fn().mockResolvedValue(['core', 'operacional', 'comercial', 'crm']),
    },
    createManifest: () => ({
      isEnabled: jest.fn().mockResolvedValue(true),
      enabledModules: jest.fn().mockResolvedValue(new Set(['core', 'operacional', 'comercial', 'crm'])),
    }),
  };
});

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import { GET, PUT, DELETE } from '@/app/api/appointments/[id]/route';
import { getUserProfile } from '@/lib/auth/session';
import {
  TN_CLINIC_A,
  TN_CLINIC_B,
  authAsOwner,
  cleanupTenantClinics,
  ensureTenantClinics,
  expectNoLeak,
} from './tenant-fixtures';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const PATIENT_B = '00000000-0000-0000-0000-00000000b261';
const APPT_B = '00000000-0000-0000-0000-00000000b262';
const SECRET_NAME = 'TnNegApptPatientB';

const ctxFor = (id: string) => ({ params: Promise.resolve({ id }) });

async function snapshotAppointment(db: any, id: string) {
  const { rows } = await db.execute(
    sql`SELECT id, clinic_id as "clinicId", patient_id as "patientId", status, notes FROM appointments WHERE id = ${id}`,
  );
  return rows[0] || null;
}

describeOrSkip('Tenant-negative appointments GET/DELETE plain — rota + DB real', () => {
  beforeAll(async () => {
    const db = getDb();
    await ensureTenantClinics(db);
    await db.execute(
      sql`INSERT INTO patients (id, clinic_id, name, phone)
          VALUES (${PATIENT_B}, ${TN_CLINIC_B}, ${SECRET_NAME}, '11999993661')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO appointments (id, clinic_id, patient_id, scheduled_at, duration_minutes, status)
          VALUES (${APPT_B}, ${TN_CLINIC_B}, ${PATIENT_B}, '2026-11-01T10:00:00Z', 30, 'scheduled')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM appointments WHERE id = ${APPT_B}`);
    await db.execute(sql`DELETE FROM patients WHERE id = ${PATIENT_B}`);
    await cleanupTenantClinics(db);
    await closeDb();
  });

  beforeEach(() => {
    (getUserProfile as jest.Mock).mockReset();
  });

  it('GET de consulta de outra clínica → 404 opaco, sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotAppointment(db, APPT_B);
    expect(before).toBeDefined();
    expect(before.clinicId).toBe(TN_CLINIC_B);

    const res = await GET(
      new Request(`http://localhost/api/appointments/${APPT_B}`) as any,
      ctxFor(APPT_B) as any,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_NAME, APPT_B, PATIENT_B]);

    expect(await snapshotAppointment(db, APPT_B)).toEqual(before);
  });

  it('PUT em consulta de outra clínica (id próprio) → 404 opaco, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotAppointment(db, APPT_B);
    expect(before).toBeDefined();

    const req = new Request(`http://localhost/api/appointments/${APPT_B}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Hacked' }),
    });
    const res = await PUT(req as any, ctxFor(APPT_B) as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_NAME, APPT_B, PATIENT_B]);

    expect(await snapshotAppointment(db, APPT_B)).toEqual(before);
  });

  it('DELETE de consulta de outra clínica → 404 opaco, status intacto (não cancela)', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotAppointment(db, APPT_B);
    expect(before).toBeDefined();

    const res = await DELETE(
      new Request(`http://localhost/api/appointments/${APPT_B}`, { method: 'DELETE' }) as any,
      ctxFor(APPT_B) as any,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_NAME, APPT_B, PATIENT_B]);

    const after = await snapshotAppointment(db, APPT_B);
    expect(after).toEqual(before);
    expect(after.status).toBe('scheduled');
  });
});
