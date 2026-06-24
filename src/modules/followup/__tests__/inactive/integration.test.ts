/**
 * Integration test: followup inactive-patient actions.
 *
 * Tests detectarInativos, listarInativos, reativarPaciente via runAction
 * with real DB. Verifies scope isolation by clinicId.
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/followup/__tests__/inactive/integration.test.ts
 */

/** @jest-environment node */

process.env.DATABASE_URL =
  'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

import { getDb } from '@/lib/db/client';
import { clinics, users } from '@/lib/db/schema/core';
import { patients } from '@/modules/operacional/schema';
import { instanceModules } from '@/lib/db/schema/modules';
import { roles, userClinicAccess } from '@/modules/core/schema/rbac';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { buildDelegatedContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';
import { detectarInativos, listarInativos, reativarPaciente } from '@/modules/followup/actions';
import { eq, and } from 'drizzle-orm';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const ts = String(Date.now()).slice(-10);
const CLINIC_ID = `a0000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const OTHER_CLINIC_ID = `b0000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const USER_ID = `c0000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const PATIENT_A = `d0000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const PATIENT_B = `e0000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;

const LONG_AGO = new Date(Date.UTC(2024, 0, 1)); // ~2.5 years ago
const RECENT = new Date(); // today

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
    await seedRbacForClinic(CLINIC_ID);
    await seedRbacForClinic(OTHER_CLINIC_ID);

    const [ownerRow] = await db.select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.clinicId, CLINIC_ID), eq(roles.name, RESERVED_ROLE_OWNER)))
      .limit(1);
    ownerRoleId = ownerRow!.id;

    // 3. Enable followup module in instance_modules (required by hasModule gate)
    // UPSERT + DO UPDATE: safe for shared row across suites; never deletes.
    await db
      .insert(instanceModules)
      .values({ moduleId: 'followup', enabled: true })
      .onConflictDoUpdate({ target: instanceModules.moduleId, set: { enabled: true } });

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
    // Restore instanceModules to neutral (enabled=false, not deleted)
    await db
      .update(instanceModules)
      .set({ enabled: false })
      .where(eq(instanceModules.moduleId, 'followup'));
    await db.delete(patients).where(eq(patients.clinicId, CLINIC_ID));
    await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, USER_ID));
    await db.delete(users).where(eq(users.id, USER_ID));
    await db.delete(roles).where(eq(roles.clinicId, CLINIC_ID));
    await db.delete(roles).where(eq(roles.clinicId, OTHER_CLINIC_ID));
    await db.delete(clinics).where(eq(clinics.id, CLINIC_ID));
    await db.delete(clinics).where(eq(clinics.id, OTHER_CLINIC_ID));
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
    // Create a patient in OTHER_CLINIC with old lastVisitAt
    const db = getDb();
    const otherPatientId = `f0000000-0000-4000-8000-${ts.padStart(12, '0')}`;
    await db.insert(patients).values({
      id: otherPatientId, clinicId: OTHER_CLINIC_ID, name: 'Paciente Outra Clinica', phone: '11999999903', lastVisitAt: LONG_AGO,
    }).onConflictDoNothing();

    const result = await runAction(listarInativos, { minDays: 30, page: 1, limit: 100 }, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');

    const names = result.data.patients.map((p: any) => p.patientName);
    expect(names).not.toContain('Paciente Outra Clinica');

    // Cleanup
    await db.delete(patients).where(eq(patients.id, otherPatientId));
  });

  // ── reativarPaciente ──────────────────────────────────────────────────────

  it('reativarPaciente reactivates an inactive patient', async () => {
    const result = await runAction(reativarPaciente, { patientId: PATIENT_A }, ctx);

    expect(result.ok).toBe(true);

    // Verify patient status is now 'active' in DB
    const db = getDb();
    const [row] = await db.select({ status: patients.status }).from(patients).where(eq(patients.id, PATIENT_A));
    expect(row?.status).toBe('active');
  });
});
