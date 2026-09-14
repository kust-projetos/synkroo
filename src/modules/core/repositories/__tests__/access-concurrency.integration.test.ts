/**
 * Integration test (W11): concurrent assignUserAccess for the SAME user+clinic
 * pair is idempotent — both callers succeed and exactly one access row remains.
 *
 * Regression: on a fresh DB, two concurrent assigns could race inside the
 * write (unique violation the arbiter path missed) and one caller failed.
 * upsertUserAccess retries once on 23505 after re-read, converging the row
 * instead of surfacing the lost race as an error.
 *
 * Run: RUN_INTEGRATION_TESTS=1 npx jest --config jest.integration.config.js src/modules/core/repositories/__tests__/access-concurrency.integration.test.ts
 */

/** @jest-environment node */

import { getDb, closeDb } from '@/lib/db/client';
import { clinics, users } from '@/lib/db/schema';
import { roles, userClinicAccess } from '@/modules/core/schema/rbac';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { assignUserAccess } from '@/modules/core/services/access-service';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { eq, and } from 'drizzle-orm';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const u = Date.now();
const CLINIC = `00000000-0000-0000-0000-${String(u).slice(-12).padStart(12, '0')}`;
const USER_A = `00000000-0000-0000-0000-0000000a${String(u).slice(-4)}`;
const USER_B = `00000000-0000-0000-0000-0000000b${String(u).slice(-4)}`;

let ownerRoleId: string;
let recepRoleId: string;

describeOrSkip('access-repository concurrency (DB real)', () => {
  beforeAll(async () => {
    const db = getDb();
    await db.insert(clinics).values({
      id: CLINIC, name: `Concurrency Clinic ${u}`, slug: `concurrency-${u}`,
      phone: '', email: `cc+${u}@t.local`,
    }).onConflictDoNothing();
    await bootstrapActions();
    await seedRbacForClinic(CLINIC);
    [ownerRoleId] = (await db.select({ id: roles.id }).from(roles)
      .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, RESERVED_ROLE_OWNER))).limit(1)).map((r) => r.id);
    [recepRoleId] = (await db.select({ id: roles.id }).from(roles)
      .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, 'Recepcionista'))).limit(1)).map((r) => r.id);
    await db.insert(users).values([
      { id: USER_A, clinicId: CLINIC, email: `cca+${u}@t.local`, name: 'Concurrent', role: 'owner', isActive: true },
      { id: USER_B, clinicId: CLINIC, email: `ccb+${u}@t.local`, name: 'Concurrent B', role: 'owner', isActive: true },
    ]).onConflictDoNothing();
    await db.insert(userClinicAccess).values([
      { userId: USER_A, clinicId: CLINIC, roleId: ownerRoleId },
      { userId: USER_B, clinicId: CLINIC, roleId: ownerRoleId },
    ]).onConflictDoNothing();
  }, 60_000);

  afterAll(async () => {
    const db = getDb();
    await db.delete(userClinicAccess).where(eq(userClinicAccess.clinicId, CLINIC));
    await db.delete(users).where(eq(users.id, USER_A));
    await db.delete(users).where(eq(users.id, USER_B));
    await db.delete(roles).where(eq(roles.clinicId, CLINIC));
    await db.delete(clinics).where(eq(clinics.id, CLINIC));
    await closeDb();
  });

  it('concurrent assigns of the same pair both succeed with one final row', async () => {
    const db = getDb();
    const results = await Promise.all([
      assignUserAccess({ userId: USER_A, clinicId: CLINIC, roleId: recepRoleId }),
      assignUserAccess({ userId: USER_A, clinicId: CLINIC, roleId: recepRoleId }),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);

    const rows = await db.select({ userId: userClinicAccess.userId, roleId: userClinicAccess.roleId })
      .from(userClinicAccess)
      .where(and(eq(userClinicAccess.userId, USER_A), eq(userClinicAccess.clinicId, CLINIC)));
    expect(rows).toHaveLength(1);
    expect(rows[0].roleId).toBe(recepRoleId);
  });

  it('sequential re-assign after concurrency still converges', async () => {
    const db = getDb();
    const r = await assignUserAccess({ userId: USER_A, clinicId: CLINIC, roleId: ownerRoleId });
    expect(r.ok).toBe(true);
    const rows = await db.select({ roleId: userClinicAccess.roleId })
      .from(userClinicAccess)
      .where(and(eq(userClinicAccess.userId, USER_A), eq(userClinicAccess.clinicId, CLINIC)));
    expect(rows).toHaveLength(1);
    expect(rows[0].roleId).toBe(ownerRoleId);
  });
});
