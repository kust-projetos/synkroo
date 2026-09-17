/**
 * Integration test: contacts (CRM unificado) cross-tenant negative (Etapa 3).
 *
 * Tenant B owns patient + lead; Tenant A (Owner session) attempts:
 *   GET /api/contacts/[id]?type=patient → 404 NOT_FOUND opaco, DB intacto
 *   GET /api/contacts/[id]?type=lead    → 404 NOT_FOUND opaco, DB intacto
 *   PUT / PATCH → 405 crm_mvp_read_only (escrita desabilitada por desenho), DB intacto
 *
 * Auth/RBAC/manifest mockados (padrão patient-reassignment); rota + DB reais.
 *
 * Run via: npm run test:integration:run -- src/__tests__/api/tenant-negative/contacts.integration.test.ts
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
import { GET, PUT, PATCH } from '@/app/api/contacts/[id]/route';
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

const PATIENT_B = '00000000-0000-0000-0000-00000000b231';
const LEAD_B = '00000000-0000-0000-0000-00000000b232';
const SECRET_PATIENT = 'TnNegContactPatientB';
const SECRET_LEAD = 'TnNegContactLeadB';

const ctxFor = (id: string) => ({ params: Promise.resolve({ id }) });

async function snapshotPatient(db: any, id: string) {
  const { rows } = await db.execute(
    sql`SELECT id, clinic_id as "clinicId", name FROM patients WHERE id = ${id}`,
  );
  return rows[0] || null;
}

async function snapshotLead(db: any, id: string) {
  const { rows } = await db.execute(
    sql`SELECT id, clinic_id as "clinicId", name, status FROM leads WHERE id = ${id}`,
  );
  return rows[0] || null;
}

describeOrSkip('Tenant-negative contacts (CRM) — rota + DB real', () => {
  beforeAll(async () => {
    const db = getDb();
    await ensureTenantClinics(db);
    await db.execute(
      sql`INSERT INTO patients (id, clinic_id, name, phone)
          VALUES (${PATIENT_B}, ${TN_CLINIC_B}, ${SECRET_PATIENT}, '11999993331')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO leads (id, clinic_id, name, phone)
          VALUES (${LEAD_B}, ${TN_CLINIC_B}, ${SECRET_LEAD}, '11999993332')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM leads WHERE id = ${LEAD_B}`);
    await db.execute(sql`DELETE FROM patients WHERE id = ${PATIENT_B}`);
    await cleanupTenantClinics(db);
    await closeDb();
  });

  beforeEach(() => {
    (getUserProfile as jest.Mock).mockReset();
  });

  it('GET ?type=patient de outra clínica → 404 opaco, sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotPatient(db, PATIENT_B);
    expect(before).toBeDefined();
    expect(before.clinicId).toBe(TN_CLINIC_B);

    const res = await GET(
      new Request(`http://localhost/api/contacts/${PATIENT_B}?type=patient`) as any,
      ctxFor(PATIENT_B) as any,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_PATIENT, PATIENT_B]);

    expect(await snapshotPatient(db, PATIENT_B)).toEqual(before);
  });

  it('GET ?type=lead de outra clínica → 404 opaco, sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotLead(db, LEAD_B);
    expect(before).toBeDefined();
    expect(before.clinicId).toBe(TN_CLINIC_B);

    const res = await GET(
      new Request(`http://localhost/api/contacts/${LEAD_B}?type=lead`) as any,
      ctxFor(LEAD_B) as any,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_LEAD, LEAD_B]);

    expect(await snapshotLead(db, LEAD_B)).toEqual(before);
  });

  it('PUT é read-only por desenho (405) e não altera nada — controle', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotPatient(db, PATIENT_B);
    expect(before).toBeDefined();

    const req = new Request(`http://localhost/api/contacts/${PATIENT_B}?type=patient`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    const res = await PUT(req as any, ctxFor(PATIENT_B) as any);
    expect(res.status).toBe(405);
    const body = await res.json();
    expectNoLeak(body, [SECRET_PATIENT, PATIENT_B]);

    expect(await snapshotPatient(db, PATIENT_B)).toEqual(before);
  });

  it('PATCH é read-only por desenho (405) e não altera nada — controle', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotLead(db, LEAD_B);
    expect(before).toBeDefined();

    const req = new Request(`http://localhost/api/contacts/${LEAD_B}?type=lead`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    const res = await PATCH(req as any, ctxFor(LEAD_B) as any);
    expect(res.status).toBe(405);
    const body = await res.json();
    expectNoLeak(body, [SECRET_LEAD, LEAD_B]);

    expect(await snapshotLead(db, LEAD_B)).toEqual(before);
  });
});
