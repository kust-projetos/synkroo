/**
 * Integration test: procedures cross-tenant negative suite (Etapa 3).
 *
 * Tenant B owns the procedure; Tenant A (Owner session) attempts:
 *   GET /api/procedures/[id]   → 404 opaco, sem vazamento, DB intacto
 *   PATCH /api/procedures/[id] → 404 opaco, sem vazamento, DB intacto
 *   DELETE → 405 (indisponível por desenho), DB intacto (controle)
 *
 * CONTRATO CANÔNICO (SYNK-IMPL-404): obter/atualizar procedimento lançam
 * ActionError not_found para id inexistente ou de outra clínica, de modo que
 * o cross-tenant responde 404 `{ error: { code: 'NOT_FOUND', ... } }` —
 * idêntico ao inexistente (opaco). Nenhum byte do tenant B é exposto e nada
 * é alterado. Ver docs/audit/tenant-resource-matrix.md.
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

  it('GET de procedimento de outra clínica → 404 opaco (idêntico a inexistente), sem vazamento, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    const db = getDb();
    const before = await snapshotProcedure(db, PROCEDURE_B);
    expect(before).toBeDefined();
    expect(before.clinicId).toBe(TN_CLINIC_B);

    const res = await GET(
      new Request(`http://localhost/api/procedures/${PROCEDURE_B}`) as any,
      ctxFor(PROCEDURE_B) as any,
    );
    // Contrato canônico opaco: 404 com envelope { error: { code, message, requestId } }.
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error?.code).toBe('NOT_FOUND');
    expect(body.data).toBeUndefined();
    expectNoLeak(body, [SECRET_NAME, PROCEDURE_B]);

    expect(await snapshotProcedure(db, PROCEDURE_B)).toEqual(before);
  });

  it('PATCH em procedimento de outra clínica → 404 opaco, sem vazamento, DB intacto', async () => {
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
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error?.code).toBe('NOT_FOUND');
    expect(body.data).toBeUndefined();
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
