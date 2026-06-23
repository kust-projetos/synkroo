/** @jest-environment node */

// Skip when RUN_INTEGRATION_TESTS is not set — guards hooks before describe.skip takes effect.
const SKIP = process.env.RUN_INTEGRATION_TESTS !== '1';

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

// Instância inline do repo que delega na query real do Drizzle
const drizzleRbacRepo: RbacRepo = {
  isMaster: async (userId: string) => false,
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
        eq(users.isActive, true),
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

let ownerUserId: string;
let recepUserId: string;
let ownerRoleId: string;
let recepRoleId: string;

beforeAll(async () => {
  if (SKIP) return;
  const db = getDb();
  await db.insert(clinics).values({
    id: CLINIC, name: 'Test Clinic', slug: 'test-clinic', phone: '', email: 't@t.local',
  }).onConflictDoNothing();
  await seedRbacForClinic(CLINIC);

  // Busca IDs dos roles após seed
  const [ownerRole] = await db.select({ id: roles.id }).from(roles)
    .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, RESERVED_ROLE_OWNER))).limit(1);
  ownerRoleId = ownerRole?.id ?? '';
  const [recepRole] = await db.select({ id: roles.id }).from(roles)
    .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, 'Recepcionista'))).limit(1);
  recepRoleId = recepRole?.id ?? '';

  const u = Date.now();
  ownerUserId = `00000000-0000-0000-0000-00000000${String(u).slice(-4)}`;
  recepUserId = `00000000-0000-0000-0000-00000000${String(u + 1).slice(-4)}`;

  await db.insert(users).values([
    { id: ownerUserId, clinicId: CLINIC, email: `rbac-owner+${u}@t.local`, name: 'Rbac Owner', role: 'owner', isActive: true },
    { id: recepUserId, clinicId: CLINIC, email: `rbac-recep+${u}@t.local`, name: 'Rbac Recep', role: 'receptionist', isActive: true },
  ]).onConflictDoNothing();
  await db.insert(userClinicAccess).values([
    { userId: ownerUserId, clinicId: CLINIC, roleId: ownerRoleId },
    { userId: recepUserId, clinicId: CLINIC, roleId: recepRoleId },
  ]).onConflictDoNothing();
});

afterAll(async () => {
  if (SKIP) return;
  const db = getDb();
  await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, ownerUserId));
  await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, recepUserId));
  await db.delete(users).where(eq(users.id, ownerUserId));
  await db.delete(users).where(eq(users.id, recepUserId));
  const { closeDb } = await import('@/lib/db/client');
  await closeDb();
});

describeOrSkip('resolveAccess — inactive users blocked (DB real)', () => {
  it('usuário inativo obtém can=never', async () => {
    const db = getDb();
    await db.update(users).set({ isActive: false }).where(eq(users.id, recepUserId));

    const result = await resolveAccess(recepUserId, CLINIC, drizzleRbacRepo);

    expect(result.can('comercial:view')).toBe(false);
    expect(result.can('core:manage_users')).toBe(false);
    expect(result.role).toBeNull();

    await db.update(users).set({ isActive: true }).where(eq(users.id, recepUserId));
  });

  it('usuário ativo com Recepcionista obtém permissões corretas', async () => {
    const result = await resolveAccess(recepUserId, CLINIC, drizzleRbacRepo);

    expect(result.role).toBe('Recepcionista');
    expect(result.can('core:manage_users')).toBe(false);
    expect(result.can('comercial:view')).toBe(true);
  });

  it('Owner obtém bypass dentro da instância mas não master-only perms', async () => {
    const result = await resolveAccess(ownerUserId, CLINIC, drizzleRbacRepo);

    expect(result.role).toBe('owner');
    expect(result.can('core:manage_users')).toBe(true);
    expect(result.can('master:delete_system')).toBe(false);
  });
});
