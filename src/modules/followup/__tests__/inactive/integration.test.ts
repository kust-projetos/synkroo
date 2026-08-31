/**
 * Integration test: followup inactive-patient actions.
 *
 * Tests detectarInativos, listarInativos, reativarPaciente via runAction
 * with real DB. Verifies scope isolation by clinicId.
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/followup/__tests__/inactive/integration.test.ts
 */

/** @jest-environment node */

import { getDb, closeDb } from '@/lib/db/client';
import { clinics, users } from '@/lib/db/schema/core';
import { patients } from '@/modules/operacional/schema';
import { instanceModules } from '@/lib/db/schema/modules';
import { roles, rolePermissions, userClinicAccess } from '@/modules/core/schema/rbac';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { buildDelegatedContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';
import { detectarInativos, listarInativos, reativarPaciente } from '@/modules/followup/actions';
import { eq, and, inArray, sql } from 'drizzle-orm';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const ts = String(Date.now()).slice(-10);
const CLINIC_ID = `a0000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const OTHER_CLINIC_ID = `b0000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const USER_ID = `c0000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const PATIENT_A = `d0000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const PATIENT_B = `e0000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;

const LONG_AGO = new Date(Date.UTC(2024, 0, 1)); // ~2.5 years ago
const RECENT = new Date(); // today

const REQUIRED_MODULES = ['operacional', 'comercial', 'atendimento', 'financeiro', 'followup'] as const;
let previousModuleState: Array<{ moduleId: string; enabled: boolean }> = [];
let moduleStateCaptured = false;

async function enableRequiredModules() {
  const db = getDb();
  if (!moduleStateCaptured) {
    previousModuleState = await db
      .select({ moduleId: instanceModules.moduleId, enabled: instanceModules.enabled })
      .from(instanceModules)
      .where(inArray(instanceModules.moduleId, [...REQUIRED_MODULES]));
    moduleStateCaptured = true;
  }
  for (const moduleId of REQUIRED_MODULES) {
    await db
      .insert(instanceModules)
      .values({ moduleId, enabled: true })
      .onConflictDoUpdate({ target: instanceModules.moduleId, set: { enabled: true } });
  }
}

async function restoreModuleState() {
  if (!moduleStateCaptured) return;
  const db = getDb();
  const previous = new Map(previousModuleState.map((row) => [row.moduleId, row.enabled]));
  for (const moduleId of REQUIRED_MODULES) {
    if (previous.has(moduleId)) {
      await db.update(instanceModules).set({ enabled: previous.get(moduleId)! })
        .where(inArray(instanceModules.moduleId, [moduleId]));
    } else {
      await db.delete(instanceModules).where(inArray(instanceModules.moduleId, [moduleId]));
    }
  }
  previousModuleState = [];
  moduleStateCaptured = false;
}

describeOrSkip('inactive actions — runAction (DB real)', () => {
  let ownerRoleId: string;
  let ctx: Awaited<ReturnType<typeof buildDelegatedContext>>;

  beforeAll(async () => {
    const db = getDb();

    // 1. Create clinics
    await db.insert(clinics).values([
      { id: CLINIC_ID, name: 'Test Inactive Clinic', slug: `test-inactive-${ts}`, phone: '', email: 'inactive@t.local' },
      { id: OTHER_CLINIC_ID, name: 'Other Clinic', slug: `other-inactive-${ts}`, phone: '', email: 'other@t.local' },
    ]).onConflictDoNothing();

    // 2. Seed RBAC (so we can create user with owner role)
    await bootstrapActions();
    await seedRbacForClinic(CLINIC_ID);
    await seedRbacForClinic(OTHER_CLINIC_ID);
    await enableRequiredModules();

    const [ownerRow] = await db.select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.clinicId, CLINIC_ID), eq(roles.name, RESERVED_ROLE_OWNER)))
      .limit(1);
    ownerRoleId = ownerRow!.id;

    // 4. Create test user
    await db.insert(users).values({
      id: USER_ID, clinicId: CLINIC_ID, email: `inactive-test-${ts}@t.local`, name: 'Test User',
      role: 'owner', isActive: true,
    }).onConflictDoNothing();

    await db.insert(userClinicAccess).values({
      userId: USER_ID, clinicId: CLINIC_ID, roleId: ownerRoleId,
    }).onConflictDoNothing();

    // 4. Create test patients
    await db.insert(patients).values([
      { id: PATIENT_A, clinicId: CLINIC_ID, name: 'Paciente Inativo A', phone: '11999999901', lastVisitAt: LONG_AGO },
      { id: PATIENT_B, clinicId: CLINIC_ID, name: 'Paciente Ativo B', phone: '11999999902', lastVisitAt: RECENT },
    ]).onConflictDoNothing();

    // 5. Build delegated context (bypasses auth session, uses DB RBAC)
    ctx = await buildDelegatedContext(USER_ID, CLINIC_ID);
  });

  afterAll(async () => {
    const db = getDb();
    try {
      await db.delete(patients).where(eq(patients.clinicId, CLINIC_ID));
      await db.delete(userClinicAccess).where(inArray(userClinicAccess.clinicId, [CLINIC_ID, OTHER_CLINIC_ID]));
      await db.delete(users).where(inArray(users.clinicId, [CLINIC_ID, OTHER_CLINIC_ID]));
      const roleRows = await db.select({ id: roles.id }).from(roles)
        .where(inArray(roles.clinicId, [CLINIC_ID, OTHER_CLINIC_ID]));
      const roleIds = roleRows.map((row) => row.id);
      if (roleIds.length) {
        await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, roleIds));
      }
      await db.delete(roles).where(inArray(roles.clinicId, [CLINIC_ID, OTHER_CLINIC_ID]));
      await db.delete(clinics).where(inArray(clinics.id, [CLINIC_ID, OTHER_CLINIC_ID]));
    } finally {
      await restoreModuleState();
      await closeDb();
    }
  });

  // ── detectarInativos ──────────────────────────────────────────────────────

  it('detectarInativos succeeds via runAction', async () => {
    const result = await runAction(detectarInativos, {}, ctx);
    expect(result.ok).toBe(true);
  });

  // ── listarInativos ────────────────────────────────────────────────────────

  it('listarInativos returns only inactive patients scoped to clinicId', async () => {
    const result = await runAction(listarInativos, { minDays: 30, page: 1, limit: 100 }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');

    const { patients: items, pagination } = result.data;
    expect(pagination.total).toBeGreaterThanOrEqual(1);

    // Only one patient (PATIENT_A) has lastVisitAt < 30 days ago
    const names = items.map((p: any) => p.patientName);
    expect(names).toContain('Paciente Inativo A');
    // PATIENT_B is recent, should NOT appear
    expect(names).not.toContain('Paciente Ativo B');
  });

  it('listarInativos respects clinic isolation (other clinic patients not visible)', async () => {
    const db = getDb();
    const otherPatientId = `f0000000-0000-4000-8000-${(Number(ts) + 10).toString().padStart(12, '0')}`;

    try {
      await db.insert(patients).values({
        id: otherPatientId, clinicId: OTHER_CLINIC_ID, name: 'Paciente Outra Clinica', phone: '11999999903', lastVisitAt: LONG_AGO,
      }).onConflictDoNothing();

      const result = await runAction(listarInativos, { minDays: 30, page: 1, limit: 100 }, ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');

      const names = result.data.patients.map((p: any) => p.patientName);
      expect(names).not.toContain('Paciente Outra Clinica');
    } finally {
      await db.delete(patients).where(eq(patients.id, otherPatientId));
    }
  });

  // ── reativarPaciente ──────────────────────────────────────────────────────

  it('reativarPaciente reactivates an inactive patient from own clinic', async () => {
    const result = await runAction(reativarPaciente, { patientId: PATIENT_A }, ctx);

    expect(result.ok).toBe(true);

    // Verify patient status is now 'active' in DB
    const db = getDb();
    const [row] = await db.select({ status: patients.status }).from(patients).where(eq(patients.id, PATIENT_A));
    expect(row?.status).toBe('active');

    // Restore original status for subsequent tests
    await db.update(patients).set({ status: 'inactive' }).where(eq(patients.id, PATIENT_A));
  });

  it('reativarPaciente returns not_found for patient from another clinic', async () => {
    const db = getDb();
    const foreignPatientId = `f0000000-0000-4000-8000-${ts.padStart(12, '0')}`;

    try {
      await db.insert(patients).values({
        id: foreignPatientId, clinicId: OTHER_CLINIC_ID, name: 'Paciente Foreign', phone: '11999999904', lastVisitAt: LONG_AGO,
      }).onConflictDoNothing();

      // Snapshot full patient row + count before
      const beforeSql = sql`SELECT id, clinic_id as "clinicId", name, phone, status, last_visit_at as "lastVisitAt", tags, risk_score as "riskScore"
                            FROM patients WHERE id = ${foreignPatientId}`;
      const { rows: [beforeRow] } = await db.execute(beforeSql);
      expect(beforeRow).toBeDefined();

      const [{ count: countBefore }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(patients)
        .where(eq(patients.id, foreignPatientId));

      // ctx is scoped to CLINIC_ID — trying to reactivate OTHER_CLINIC patient
      const result = await runAction(reativarPaciente, { patientId: foreignPatientId }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('not_found');
      }

      // Full row unchanged after action (no mutation)
      const { rows: [afterRow] } = await db.execute(beforeSql);
      expect(afterRow).toEqual(beforeRow);

      const [{ count: countAfter }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(patients)
        .where(eq(patients.id, foreignPatientId));
      expect(countAfter).toBe(countBefore);
    } finally {
      await db.delete(patients).where(eq(patients.id, foreignPatientId));
    }
  });

  it('reativarPaciente ignores forged clinicId in input, uses ctx.clinicId', async () => {
    const db = getDb();
    const foreignPatientId = `a1000000-0000-4000-8000-${ts.padStart(12, '0')}`;

    try {
      await db.insert(patients).values({
        id: foreignPatientId, clinicId: OTHER_CLINIC_ID, name: 'Paciente Foreign Forgery', phone: '11999999905', lastVisitAt: LONG_AGO,
      }).onConflictDoNothing();

      // Snapshot full patient row + count before
      const beforeSql = sql`SELECT id, clinic_id as "clinicId", name, phone, status, last_visit_at as "lastVisitAt", tags, risk_score as "riskScore"
                            FROM patients WHERE id = ${foreignPatientId}`;
      const { rows: [beforeRow] } = await db.execute(beforeSql);
      expect(beforeRow).toBeDefined();

      const [{ count: countBefore }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(patients)
        .where(eq(patients.id, foreignPatientId));

      // Pass explicit clinicId in input — guard rejects untrusted selector before handler (W1.4)
      const result = await runAction(reativarPaciente, {
        patientId: foreignPatientId,
        clinicId: OTHER_CLINIC_ID, // forged — guard should reject as invalid_input
      }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('invalid_input');
      }

      // Full row unchanged after action
      const { rows: [afterRow] } = await db.execute(beforeSql);
      expect(afterRow).toEqual(beforeRow);

      const [{ count: countAfter }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(patients)
        .where(eq(patients.id, foreignPatientId));
      expect(countAfter).toBe(countBefore);
    } finally {
      await db.delete(patients).where(eq(patients.id, foreignPatientId));
    }
  });
});
