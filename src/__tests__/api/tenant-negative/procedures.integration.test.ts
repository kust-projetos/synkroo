/**
 * Integration test: procedures cross-tenant negative suite (Etapa 3).
 *
 * Tenant B owns the procedure; Tenant A (Owner session) attempts:
 *   GET /api/procedures/[id]   → opaco, sem vazamento, DB intacto
 *   PATCH /api/procedures/[id] → opaco, sem vazamento, DB intacto
 *   DELETE → 405 (indisponível por desenho), DB intacto (controle)
 *
 * GAP DE CONTRATO PROVADO (sem vazamento): idêntico ao de dentistas —
 * obter/atualizar procedimento retornam `null` em vez de lançar ActionError
 * not_found, de modo que o cross-tenant responde 200 `{ data: null }` em vez
 * do 404 opaco canônico. Nenhum byte do tenant B é exposto e nada é alterado.
 * Correção em produção NÃO feita aqui — ver BLOCKERS do relatório Etapa 3
 * e docs/audit/tenant-resource-matrix.md.
 *
 * Auth/RBAC/manifest mockados (padrão patient-reassignment); rota + DB reais.
 *
 * Run via: npm run test:integration:run -- src/__tests__/api/tenant-negative/procedures.integration.test.ts
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
import { GET, PATCH, DELETE } from '@/app/api/procedures/[id]/route';
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

const PROCEDURE_B = '00000000-0000-0000-0000-00000000b212';
const SECRET_NAME = 'TnNegProcedureB';

const ctxFor = (id: string) => ({ params: Promise.resolve({ id }) });

async function snapshotProcedure(db: any, id: string) {
  const { rows } = await db.execute(
    sql`SELECT id, clinic_id as "clinicId", name FROM procedures WHERE id = ${id}`,
  );
  return rows[0] || null;
}

describeOrSkip('Tenant-negative procedures — rota + DB real', () => {
  beforeAll(async () => {
    const db = getDb();
    await ensureTenantClinics(db);
    await db.execute(
      sql`INSERT INTO procedures (id, clinic_id, name)
          VALUES (${PROCEDURE_B}, ${TN_CLINIC_B}, ${SECRET_NAME})
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM procedures WHERE id = ${PROCEDURE_B}`);
    await cleanupTenantClinics(db);
    await closeDb();
  });

  beforeEach(() => {
    (getUserProfile as jest.Mock).mockReset();
  });

  it('GET de procedimento de outra clínica → opaco (200 data:null), sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotProcedure(db, PROCEDURE_B);
    expect(before).toBeDefined();
    expect(before.clinicId).toBe(TN_CLINIC_B);

    const res = await GET(
      new Request(`http://localhost/api/procedures/${PROCEDURE_B}`) as any,
      ctxFor(PROCEDURE_B) as any,
    );
    // Comportamento canônico real (gap de contrato, sem vazamento): 200 data:null.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeNull();
    expectNoLeak(body, [SECRET_NAME, PROCEDURE_B]);

    expect(await snapshotProcedure(db, PROCEDURE_B)).toEqual(before);
  });

  it('PATCH em procedimento de outra clínica → opaco (200 data:null), sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotProcedure(db, PROCEDURE_B);
    expect(before).toBeDefined();

    const req = new Request(`http://localhost/api/procedures/${PROCEDURE_B}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    const res = await PATCH(req as any, ctxFor(PROCEDURE_B) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeNull();
    expectNoLeak(body, [SECRET_NAME, PROCEDURE_B]);

    expect(await snapshotProcedure(db, PROCEDURE_B)).toEqual(before);
  });

  it('DELETE é indisponível por desenho (405) e não altera nada — controle', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotProcedure(db, PROCEDURE_B);
    expect(before).toBeDefined();

    const res = await DELETE();
    expect(res.status).toBe(405);
    const body = await res.json();
    expectNoLeak(body, [SECRET_NAME, PROCEDURE_B]);

    expect(await snapshotProcedure(db, PROCEDURE_B)).toEqual(before);
  });
});
