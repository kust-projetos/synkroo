/**
 * Integration tests para resolve-access: usuário INATIVO com access row existente.
 * Prove que resolveAccess filtra users.isActive=true → role=null, permissions=[].
 *
 * precondição: drizzleRbacRepo.getAccess filtra users.isActive=true.
 */

/** @jest-environment node */

jest.unmock('@/lib/db/client');
process.env.DATABASE_URL = 'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

import { resolveAccess } from '../../resolve';
import type { RbacRepo } from '../../repository';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { getDb } from '@/lib/db/client';
import { clinics, users } from '@/lib/db/schema';
import { roles, userClinicAccess, rolePermissions } from '@/modules/core/schema/rbac';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { eq, and } from 'drizzle-orm';

const CLINIC = '00000000-0000-0000-0000-000000000001';
const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const drizzleRbacRepo: RbacRepo = {
  isMaster: async () => false,
  getAccess: async (userId: string, clinicId: string) => {
    const db = getDb();
    const [row] = await db
      .select({
        roleId: userClinicAccess.roleId,
        roleName: roles.name,
        isSystem: roles.isSystem,
      })
      .from(userClinicAccess)
      .innerJoin(roles, eq(roles.id, userClinicAccess.roleId))
      .innerJoin(users, eq(users.id, userClinicAccess.userId))
      .where(and(
        eq(userClinicAccess.userId, userId),
        eq(userClinicAccess.clinicId, clinicId),
        eq(users.isActive, true), // ← filtro anti-lockout
      ))
      .limit(1);
    if (!row) return null;
    return { roleId: row.roleId, roleName: row.roleName, isSystem: row.isSystem ?? false };
  },
  getRolePermissions: async (roleId: string) => {
    const db = getDb();
    const rows = await db.select({ key: rolePermissions.permissionKey })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));
    return rows.map((r) => r.key);
  },
  getOverrides: async () => [],
};

describeOrSkip('resolve-access — usuário inativo com access row (DB real)', () => {
  const ts = String(Date.now()).slice(-8);
  const inactiveUserId = `00000000-0000-0000-0000-0009${ts}`;
  let ownerRoleId: string;

  beforeAll(async () => {
    const db = getDb();
    await db.insert(clinics).values({
      id: CLINIC, name: 'Test Clinic RA', slug: 'test-clinic-ra', phone: '', email: 'ra@t.local',
    }).onConflictDoNothing();
    await seedRbacForClinic(CLINIC);

    const [ownerRole] = await db.select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, RESERVED_ROLE_OWNER)))
      .limit(1);
    ownerRoleId = ownerRole?.id ?? '';
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, inactiveUserId));
    await db.delete(users).where(eq(users.id, inactiveUserId));
    const { closeDb } = await import('@/lib/db/client');
    await closeDb();
  });

  it('resolveAccess retorna role=null e sem permissões para usuário inativo com access row', async () => {
    const db = getDb();

    // Insere usuário JÁ INATIVO com access row Owner
    await db.insert(users).values({
      id: inactiveUserId,
      clinicId: CLINIC,
      email: `inactive-ra+${ts}@t.local`,
      name: 'Inactive RA',
      role: 'owner',
      isActive: false, // ← JÁ inativo desde a criação
    }).onConflictDoNothing();
    await db.insert(userClinicAccess).values({
      userId: inactiveUserId,
      clinicId: CLINIC,
      roleId: ownerRoleId,
    }).onConflictDoNothing();

    // getAccess filtra isActive=true → não encontra o usuário
    const result = await resolveAccess(inactiveUserId, CLINIC, drizzleRbacRepo);

    expect(result.role).toBeNull();
    expect(result.can('core:manage_users')).toBe(false);
  });
});
