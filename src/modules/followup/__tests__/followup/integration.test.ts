/**
 * Integration test: followup core actions (executarFollowup, listarPendentes, registrarFollowup).
 *
 * Tests F3 followup actions via runAction with real DB and RBAC context.
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/followup/__tests__/followup/integration.test.ts
 */

/** @jest-environment node */

import { getDb, closeDb } from '@/lib/db/client';
import { clinics, users } from '@/lib/db/schema/core';
import { patients } from '@/modules/operacional/schema';
import { appointments } from '@/modules/operacional/schema/appointments';
import { procedures } from '@/modules/operacional/schema/clinical';
import { instanceModules } from '@/lib/db/schema/modules';
import { roles, userClinicAccess } from '@/modules/core/schema/rbac';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { buildDelegatedContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';
import { executarFollowup, listarPendentes, registrarFollowup } from '@/modules/followup/actions';
import { eq, and } from 'drizzle-orm';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const ts = String(Date.now()).slice(-10);
const CLINIC_ID = `10000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const USER_ID = `20000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const PATIENT_ID = `30000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const APPOINTMENT_ID = `40000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const PROCEDURE_ID = `50000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;
const DENTIST_ID = `51000000-0000-4000-8000-${ts.padStart(12, '0')}` as const;

describeOrSkip('followup core actions — runAction (DB real)', () => {
  let ctx: Awaited<ReturnType<typeof buildDelegatedContext>>;

  beforeAll(async () => {
    const db = getDb();

    // 1. Clinic
    await db.insert(clinics).values({
      id: CLINIC_ID, name: 'Test Followup Clinic', slug: `test-followup-${ts}`, phone: '', email: 'followup@t.local',
    }).onConflictDoNothing();

    // 2. RBAC
    await seedRbacForClinic(CLINIC_ID);

    const [ownerRow] = await db.select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.clinicId, CLINIC_ID), eq(roles.name, RESERVED_ROLE_OWNER)))
      .limit(1);

    // 3. User + access
    await db.insert(users).values({
      id: USER_ID, clinicId: CLINIC_ID, email: `followup-test-${ts}@t.local`, name: 'Test User',
      role: 'owner', isActive: true,
    }).onConflictDoNothing();

    await db.insert(userClinicAccess).values({
      userId: USER_ID, clinicId: CLINIC_ID, roleId: ownerRow!.id,
    }).onConflictDoNothing();

    // 4. Enable followup module in instance_modules (required by hasModule gate)
    // UPSERT + DO UPDATE: safe for shared row across suites; never deletes.
    await db
      .insert(instanceModules)
      .values({ moduleId: 'followup', enabled: true })
      .onConflictDoUpdate({ target: instanceModules.moduleId, set: { enabled: true } });

    // 4. Patient
    await db.insert(patients).values({
      id: PATIENT_ID, clinicId: CLINIC_ID, name: 'Paciente Followup', phone: '11999999909',
    }).onConflictDoNothing();

    // 5. Procedure (referenced by appointments FK)
    await db.insert(procedures).values({
      id: PROCEDURE_ID, clinicId: CLINIC_ID, name: 'Limpeza', durationMinutes: 30,
    }).onConflictDoNothing();

    // 6. Appointment (completed, 48h+ ago — eligible for post-consultation followup)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await db.insert(appointments).values({
      id: APPOINTMENT_ID, clinicId: CLINIC_ID, patientId: PATIENT_ID,
      procedureId: PROCEDURE_ID,
      scheduledAt: twoDaysAgo, status: 'completed',
    }).onConflictDoNothing();

    // 7. Context
    ctx = await buildDelegatedContext(USER_ID, CLINIC_ID);
  });

  afterAll(async () => {
    const db = getDb();
    // Restore instanceModules to neutral (enabled=false, not deleted)
    await db
      .update(instanceModules)
      .set({ enabled: false })
      .where(eq(instanceModules.moduleId, 'followup'));
    await db.delete(appointments).where(eq(appointments.clinicId, CLINIC_ID));
    await db.delete(procedures).where(eq(procedures.clinicId, CLINIC_ID));
    await db.delete(patients).where(eq(patients.clinicId, CLINIC_ID));
    await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, USER_ID));
    await db.delete(users).where(eq(users.id, USER_ID));
    await db.delete(roles).where(eq(roles.clinicId, CLINIC_ID));
    await db.delete(clinics).where(eq(clinics.id, CLINIC_ID));
    await closeDb();
  });

  // ── executarFollowup ──────────────────────────────────────────────────────

  it('executarFollowup succeeds via runAction (type all)', async () => {
    const result = await runAction(executarFollowup, { type: 'all' }, ctx);
    expect(result.ok).toBe(true);
  });

  it('executarFollowup succeeds via runAction (type post_consultation)', async () => {
    const result = await runAction(executarFollowup, { type: 'post_consultation' }, ctx);
    expect(result.ok).toBe(true);
  });

  // ── listarPendentes ───────────────────────────────────────────────────────

  it('listarPendentes returns items scoped to clinicId', async () => {
    const result = await runAction(listarPendentes, { type: 'post_consultation' }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');

    const { items, total } = result.data;
    expect(Array.isArray(items)).toBe(true);
    expect(typeof total).toBe('number');

    // All returned items should belong to our clinic
    for (const item of items as any[]) {
      if (item.clinicId) {
        expect(item.clinicId).toBe(CLINIC_ID);
      }
    }
  });

  // ── registrarFollowup ─────────────────────────────────────────────────────

  it('registrarFollowup records feedback successfully', async () => {
    const result = await runAction(registrarFollowup, {
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
      feedbackType: 'post_consultation',
      rating: 5,
      npsScore: 10,
      comments: 'Ótimo atendimento',
    }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.success).toBe(true);
  });

  // ── RBAC gate ─────────────────────────────────────────────────────────────

  it('listarPendentes is forbidden without followup:view permission', async () => {
    // Build a context with a role that lacks followup:view
    // Create a minimal role with only operacional:view
    const db = getDb();
    const [restrictedRole] = await db.insert(roles).values({
      clinicId: CLINIC_ID, name: 'Restricted Test', description: 'No followup', isSystem: true,
    }).returning({ id: roles.id });

    const restrictedUserId = `60000000-0000-4000-8000-${ts.padStart(12, '0')}`;
    await db.insert(users).values({
      id: restrictedUserId, clinicId: CLINIC_ID, email: `restricted-${ts}@t.local`, name: 'Restricted',
      role: 'receptionist', isActive: true,
    }).onConflictDoNothing();

    await db.insert(userClinicAccess).values({
      userId: restrictedUserId, clinicId: CLINIC_ID, roleId: restrictedRole.id,
    }).onConflictDoNothing();

    const restrictedCtx = await buildDelegatedContext(restrictedUserId, CLINIC_ID);

    const result = await runAction(listarPendentes, { type: 'post_consultation' }, restrictedCtx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('forbidden');
    }

    // Cleanup
    await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, restrictedUserId));
    await db.delete(users).where(eq(users.id, restrictedUserId));
    await db.delete(roles).where(eq(roles.id, restrictedRole.id));
  });
});
