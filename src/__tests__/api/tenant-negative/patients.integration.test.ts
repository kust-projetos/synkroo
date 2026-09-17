/**
 * Integration test: patients cross-tenant negative suite (Etapa 3).
 *
 * Tenant B owns the patient; Tenant A (Owner session) attempts:
 *   GET /api/patients/[id]    → 404 NOT_FOUND opaco, sem vazamento, DB intacto
 *   PUT /api/patients/[id]    → 404 NOT_FOUND opaco, sem vazamento, DB intacto
 *   PATCH /api/patients/[id]  → 404 NOT_FOUND opaco, sem vazamento, DB intacto
 *   DELETE (deprecated 410)   → 410, sem vazamento, DB intacto (controle)
 *
 * Auth/RBAC/manifest mockados (padrão patient-reassignment); rota + DB reais.
 *
 * Run via: npm run test:integration:run -- src/__tests__/api/tenant-negative/patients.integration.test.ts
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
import { GET, PUT, PATCH, DELETE } from '@/app/api/patients/[id]/route';
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

const PATIENT_B = '00000000-0000-0000-0000-00000000b221';
const SECRET_NAME = 'TnNegPatientB';

const ctxFor = (id: string) => ({ params: Promise.resolve({ id }) });

async function snapshotPatient(db: any, id: string) {
  const { rows } = await db.execute(
    sql`SELECT id, clinic_id as "clinicId", name, phone, notes FROM patients WHERE id = ${id}`,
  );
  return rows[0] || null;
}

describeOrSkip('Tenant-negative patients — rota + DB real', () => {
  beforeAll(async () => {
    const db = getDb();
    await ensureTenantClinics(db);
    await db.execute(
      sql`INSERT INTO patients (id, clinic_id, name, phone)
          VALUES (${PATIENT_B}, ${TN_CLINIC_B}, ${SECRET_NAME}, '11999993221')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM patients WHERE id = ${PATIENT_B}`);
    await cleanupTenantClinics(db);
    await closeDb();
  });

  beforeEach(() => {
    (getUserProfile as jest.Mock).mockReset();
  });

  it('GET de paciente de outra clínica → 404 opaco, sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotPatient(db, PATIENT_B);
    expect(before).toBeDefined();
    expect(before.clinicId).toBe(TN_CLINIC_B);

    const res = await GET(
      new Request(`http://localhost/api/patients/${PATIENT_B}`) as any,
      ctxFor(PATIENT_B) as any,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_NAME, PATIENT_B]);

    expect(await snapshotPatient(db, PATIENT_B)).toEqual(before);
  });

  it('PUT em paciente de outra clínica → 404 opaco, sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotPatient(db, PATIENT_B);
    expect(before).toBeDefined();

    const req = new Request(`http://localhost/api/patients/${PATIENT_B}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    const res = await PUT(req as any, ctxFor(PATIENT_B) as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_NAME, PATIENT_B]);

    expect(await snapshotPatient(db, PATIENT_B)).toEqual(before);
  });

  it('PATCH em paciente de outra clínica → 404 opaco, sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotPatient(db, PATIENT_B);
    expect(before).toBeDefined();

    const req = new Request(`http://localhost/api/patients/${PATIENT_B}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Hacked note' }),
    });
    const res = await PATCH(req as any, ctxFor(PATIENT_B) as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_NAME, PATIENT_B]);

    expect(await snapshotPatient(db, PATIENT_B)).toEqual(before);
  });

  it('DELETE é deprecated (410) e não vaza nem altera nada — controle', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotPatient(db, PATIENT_B);
    expect(before).toBeDefined();

    const res = await DELETE();
    expect(res.status).toBe(410);
    const body = await res.json();
    expectNoLeak(body, [SECRET_NAME, PATIENT_B]);

    expect(await snapshotPatient(db, PATIENT_B)).toEqual(before);
  });
});
