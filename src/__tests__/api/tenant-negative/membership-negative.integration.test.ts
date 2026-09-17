/**
 * Integration test: membership negative em nível de rota (Etapa 3).
 *
 * Usa GET /api/patients/[id] como rota representativa do caminho canônico
 * (buildUserContext → resolveAccess → runAction). RBAC de unidade já cobre
 * resolveAccess; aqui prova-se o comportamento na borda HTTP, com DB real:
 *   (a) sem sessão (getUserProfile → null)        → 401 UNAUTHORIZED, sem dados
 *   (b) identidade malformada (perfil sem vínculo) → 401 UNAUTHORIZED, sem dados
 *   (c) sessão válida mas membership removida
 *       (getAccess → null, ex. usuário desligado)  → 403 FORBIDDEN, sem dados, DB intacto
 *
 * Auth/RBAC/manifest mockados (padrão patient-reassignment); rota + DB reais.
 *
 * Run via: npm run test:integration:run -- src/__tests__/api/tenant-negative/membership-negative.integration.test.ts
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
import { GET } from '@/app/api/patients/[id]/route';
import { getUserProfile } from '@/lib/auth/session';
import { drizzleRbacRepo } from '@/core/rbac/repository';
import {
  TN_CLINIC_A,
  TN_CLINIC_B,
  authAsOwner,
  cleanupTenantClinics,
  ensureTenantClinics,
  expectNoLeak,
} from './tenant-fixtures';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const PATIENT_A = '00000000-0000-0000-0000-00000000a271';
const SECRET_NAME = 'TnNegMemberPatientA';

const ctxFor = (id: string) => ({ params: Promise.resolve({ id }) });

async function snapshotPatient(db: any, id: string) {
  const { rows } = await db.execute(
    sql`SELECT id, clinic_id as "clinicId", name FROM patients WHERE id = ${id}`,
  );
  return rows[0] || null;
}

describeOrSkip('Tenant-negative membership — rota + DB real', () => {
  beforeAll(async () => {
    const db = getDb();
    await ensureTenantClinics(db);
    await db.execute(
      sql`INSERT INTO patients (id, clinic_id, name, phone)
          VALUES (${PATIENT_A}, ${TN_CLINIC_A}, ${SECRET_NAME}, '11999993771')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM patients WHERE id = ${PATIENT_A}`);
    await cleanupTenantClinics(db);
    await closeDb();
  });

  beforeEach(() => {
    (getUserProfile as jest.Mock).mockReset();
  });

  it('(a) sem sessão → 401 UNAUTHORIZED, sem dados', async () => {
    (getUserProfile as jest.Mock).mockResolvedValue(null);

    const res = await GET(
      new Request(`http://localhost/api/patients/${PATIENT_A}`) as any,
      ctxFor(PATIENT_A) as any,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expectNoLeak(body, [SECRET_NAME, PATIENT_A]);
  });

  it('(b) identidade malformada (perfil sem vínculo de clínica) → 401, sem dados', async () => {
    (getUserProfile as jest.Mock).mockResolvedValue({ id: 'malformed-user' });

    const res = await GET(
      new Request(`http://localhost/api/patients/${PATIENT_A}`) as any,
      ctxFor(PATIENT_A) as any,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expectNoLeak(body, [SECRET_NAME, PATIENT_A]);
  });

  it('(c) membership removida (getAccess → null) → 403 FORBIDDEN, sem dados, DB intacto', async () => {
    authAsOwner(getUserProfile as jest.Mock, TN_CLINIC_A);
    // Sessão válida, mas o vínculo usuário→clínica não existe mais (ex. desligado).
    (drizzleRbacRepo.getAccess as jest.Mock).mockResolvedValueOnce(null);
    const db = getDb();
    const before = await snapshotPatient(db, PATIENT_A);
    expect(before).toBeDefined();

    const res = await GET(
      new Request(`http://localhost/api/patients/${PATIENT_A}`) as any,
      ctxFor(PATIENT_A) as any,
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
    expectNoLeak(body, [SECRET_NAME, PATIENT_A]);

    expect(await snapshotPatient(db, PATIENT_A)).toEqual(before);
  });
});
