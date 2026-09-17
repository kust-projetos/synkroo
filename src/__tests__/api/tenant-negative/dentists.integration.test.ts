/**
 * Integration test: dentists cross-tenant negative suite (Etapa 3).
 *
 * Tenant B owns the dentist; Tenant A (Owner session) attempts:
 *   GET /api/dentists/[id]   → opaco, sem vazamento, DB intacto
 *   PATCH /api/dentists/[id] → opaco, sem vazamento, DB intacto
 *   DELETE → 405 (indisponível por desenho), DB intacto (controle)
 *
 * GAP DE CONTRATO PROVADO (sem vazamento): obter/atualizar dentista retornam
 * `null` em vez de lançar ActionError not_found, de modo que o cross-tenant
 * responde 200 `{ data: null }` em vez do 404 opaco canônico. Nenhum byte do
 * tenant B é exposto e nada é alterado — os testes fixam esse comportamento
 * real (200 + data null + sem vazamento + DB intacto). A correção em produção
 * (lançar not_found) NÃO foi feita aqui — ver BLOCKERS do relatório Etapa 3
 * e docs/audit/tenant-resource-matrix.md.
 *
 * Auth/RBAC/manifest mockados (padrão patient-reassignment); rota + DB reais.
 *
 * Run via: npm run test:integration:run -- src/__tests__/api/tenant-negative/dentists.integration.test.ts
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
import { GET, PATCH, DELETE } from '@/app/api/dentists/[id]/route';
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

const DENTIST_B = '00000000-0000-0000-0000-00000000b211';
const SECRET_NAME = 'TnNegDentistB';

const ctxFor = (id: string) => ({ params: Promise.resolve({ id }) });

async function snapshotDentist(db: any, id: string) {
  const { rows } = await db.execute(
    sql`SELECT id, clinic_id as "clinicId", name FROM dentists WHERE id = ${id}`,
  );
  return rows[0] || null;
}

describeOrSkip('Tenant-negative dentists — rota + DB real', () => {
  beforeAll(async () => {
    const db = getDb();
    await ensureTenantClinics(db);
    await db.execute(
      sql`INSERT INTO dentists (id, clinic_id, name)
          VALUES (${DENTIST_B}, ${TN_CLINIC_B}, ${SECRET_NAME})
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM dentists WHERE id = ${DENTIST_B}`);
    await cleanupTenantClinics(db);
    await closeDb();
  });

  beforeEach(() => {
    (getUserProfile as jest.Mock).mockReset();
  });

  it('GET de dentista de outra clínica → opaco (200 data:null), sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotDentist(db, DENTIST_B);
    expect(before).toBeDefined();
    expect(before.clinicId).toBe(TN_CLINIC_B);

    const res = await GET(
      new Request(`http://localhost/api/dentists/${DENTIST_B}`) as any,
      ctxFor(DENTIST_B) as any,
    );
    // Comportamento canônico real (gap de contrato, sem vazamento): 200 data:null.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeNull();
    expectNoLeak(body, [SECRET_NAME, DENTIST_B]);

    expect(await snapshotDentist(db, DENTIST_B)).toEqual(before);
  });

  it('PATCH em dentista de outra clínica → opaco (200 data:null), sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotDentist(db, DENTIST_B);
    expect(before).toBeDefined();

    const req = new Request(`http://localhost/api/dentists/${DENTIST_B}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    const res = await PATCH(req as any, ctxFor(DENTIST_B) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeNull();
    expectNoLeak(body, [SECRET_NAME, DENTIST_B]);

    expect(await snapshotDentist(db, DENTIST_B)).toEqual(before);
  });

  it('DELETE é indisponível por desenho (405) e não altera nada — controle', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotDentist(db, DENTIST_B);
    expect(before).toBeDefined();

    const res = await DELETE();
    expect(res.status).toBe(405);
    const body = await res.json();
    expectNoLeak(body, [SECRET_NAME, DENTIST_B]);

    expect(await snapshotDentist(db, DENTIST_B)).toEqual(before);
  });
});
