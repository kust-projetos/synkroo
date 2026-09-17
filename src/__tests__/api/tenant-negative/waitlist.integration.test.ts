/**
 * Integration test: waitlist cross-tenant negative suite (Etapa 3).
 *
 * Tenant B owns patient + waitlist entry; Tenant A (Owner session) attempts:
 *   GET /api/waitlist?id=...    → 404 NOT_FOUND opaco, sem vazamento, DB intacto
 *   PATCH /api/waitlist {id}    → 404 NOT_FOUND opaco, sem vazamento, DB intacto
 *   DELETE /api/waitlist?id=... → 404 NOT_FOUND opaco (não cancela), status intacto
 *
 * Auth/RBAC/manifest mockados (padrão patient-reassignment); rota + DB reais.
 *
 * Run via: npm run test:integration:run -- src/__tests__/api/tenant-negative/waitlist.integration.test.ts
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
import { GET, PATCH, DELETE } from '@/app/api/waitlist/route';
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

const PATIENT_B = '00000000-0000-0000-0000-00000000b251';
const WAITLIST_B = '00000000-0000-0000-0000-00000000b252';
const SECRET_NAME = 'TnNegWaitlistPatientB';

async function snapshotWaitlist(db: any, id: string) {
  const { rows } = await db.execute(sql`SELECT * FROM waitlist WHERE id = ${id}`);
  return rows[0] || null;
}

describeOrSkip('Tenant-negative waitlist — rota + DB real', () => {
  beforeAll(async () => {
    const db = getDb();
    await ensureTenantClinics(db);
    await db.execute(
      sql`INSERT INTO patients (id, clinic_id, name, phone)
          VALUES (${PATIENT_B}, ${TN_CLINIC_B}, ${SECRET_NAME}, '11999993551')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO waitlist (id, clinic_id, patient_id, status)
          VALUES (${WAITLIST_B}, ${TN_CLINIC_B}, ${PATIENT_B}, 'waiting')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM waitlist WHERE id = ${WAITLIST_B}`);
    await db.execute(sql`DELETE FROM patients WHERE id = ${PATIENT_B}`);
    await cleanupTenantClinics(db);
    await closeDb();
  });

  beforeEach(() => {
    (getUserProfile as jest.Mock).mockReset();
  });

  it('GET ?id de entrada de outra clínica → 404 opaco, sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotWaitlist(db, WAITLIST_B);
    expect(before).toBeDefined();

    const res = await GET(
      new Request(`http://localhost/api/waitlist?id=${WAITLIST_B}`) as any,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_NAME, WAITLIST_B, PATIENT_B]);

    expect(await snapshotWaitlist(db, WAITLIST_B)).toEqual(before);
  });

  it('PATCH em entrada de outra clínica → 404 opaco, sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotWaitlist(db, WAITLIST_B);
    expect(before).toBeDefined();

    const req = new Request('http://localhost/api/waitlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: WAITLIST_B, notes: 'Hacked' }),
    });
    const res = await PATCH(req as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_NAME, WAITLIST_B, PATIENT_B]);

    expect(await snapshotWaitlist(db, WAITLIST_B)).toEqual(before);
  });

  it('DELETE de entrada de outra clínica → 404 opaco, status intacto (não cancela)', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotWaitlist(db, WAITLIST_B);
    expect(before).toBeDefined();

    const res = await DELETE(
      new Request(`http://localhost/api/waitlist?id=${WAITLIST_B}`, { method: 'DELETE' }) as any,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expectNoLeak(body, [SECRET_NAME, WAITLIST_B, PATIENT_B]);

    const after = await snapshotWaitlist(db, WAITLIST_B);
    expect(after).toEqual(before);
    expect(after.status).toBe('waiting');
  });
});
