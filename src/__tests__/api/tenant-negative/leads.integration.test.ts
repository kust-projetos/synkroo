/**
 * Integration test: leads (comercial) cross-tenant negative suite (Etapa 3).
 *
 * Tenant B owns the lead; Tenant A (Owner session) attempts:
 *   GET /api/leads/[id]    → 404 NOT_FOUND opaco, sem vazamento, DB intacto
 *   PUT /api/leads/[id]    → 404 NOT_FOUND opaco, sem vazamento, DB intacto
 *   DELETE /api/leads/[id] → 404 NOT_FOUND opaco (não arquiva), status intacto
 *
 * Auth/RBAC/manifest mockados (padrão patient-reassignment); rota + DB reais.
 *
 * Run via: npm run test:integration:run -- src/__tests__/api/tenant-negative/leads.integration.test.ts
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
import { GET, PUT, DELETE } from '@/app/api/leads/[id]/route';
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

const LEAD_B = '00000000-0000-0000-0000-00000000b241';
const SECRET_NAME = 'TnNegLeadB';

const ctxFor = (id: string) => ({ params: Promise.resolve({ id }) });

async function snapshotLead(db: any, id: string) {
  const { rows } = await db.execute(
    sql`SELECT id, clinic_id as "clinicId", name, status FROM leads WHERE id = ${id}`,
  );
  return rows[0] || null;
}

describeOrSkip('Tenant-negative leads (comercial) — rota + DB real', () => {
  beforeAll(async () => {
    const db = getDb();
    await ensureTenantClinics(db);
    await db.execute(
      sql`INSERT INTO leads (id, clinic_id, name, phone)
          VALUES (${LEAD_B}, ${TN_CLINIC_B}, ${SECRET_NAME}, '11999993441')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM leads WHERE id = ${LEAD_B}`);
    await cleanupTenantClinics(db);
    await closeDb();
  });

  beforeEach(() => {
    (getUserProfile as jest.Mock).mockReset();
  });

  it('GET de lead de outra clínica → 404 opaco, sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotLead(db, LEAD_B);
    expect(before).toBeDefined();
    expect(before.clinicId).toBe(TN_CLINIC_B);

    const res = await GET(
      new Request(`http://localhost/api/leads/${LEAD_B}`) as any,
      ctxFor(LEAD_B) as any,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_NAME, LEAD_B]);

    expect(await snapshotLead(db, LEAD_B)).toEqual(before);
  });

  it('PUT em lead de outra clínica → 404 opaco, sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotLead(db, LEAD_B);
    expect(before).toBeDefined();

    const req = new Request(`http://localhost/api/leads/${LEAD_B}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    const res = await PUT(req as any, ctxFor(LEAD_B) as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_NAME, LEAD_B]);

    expect(await snapshotLead(db, LEAD_B)).toEqual(before);
  });

  it('DELETE (arquivar) lead de outra clínica → 404 opaco, status intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotLead(db, LEAD_B);
    expect(before).toBeDefined();

    const res = await DELETE(
      new Request(`http://localhost/api/leads/${LEAD_B}`, { method: 'DELETE' }) as any,
      ctxFor(LEAD_B) as any,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_NAME, LEAD_B]);

    const after = await snapshotLead(db, LEAD_B);
    expect(after).toEqual(before);
    expect(after.status).toBe(before.status);
  });
});
