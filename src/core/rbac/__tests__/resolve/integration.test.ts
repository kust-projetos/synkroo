/** @jest-environment node */

// Skip when RUN_INTEGRATION_TESTS is not set — guards hooks before describe.skip takes effect.
const SKIP = process.env.RUN_INTEGRATION_TESTS !== '1';

jest.unmock('@/lib/db/client');

import { resolveAccess } from '../../resolve';
import { drizzleRbacRepo } from '../../repository';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { getDb } from '@/lib/db/client';
import { clinics, users } from '@/lib/db/schema';
import { roles, userClinicAccess, userPermissionOverrides } from '@/modules/core/schema/rbac';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { eq, and } from 'drizzle-orm';

const CLINIC = '00000000-0000-0000-0000-000000000001';
const CLINIC_B = '00000000-0000-0000-0000-000000000002';
const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

let ownerUserId: string;
let recepUserId: string;
let ownerRoleId: string;
let recepRoleId: string;
let recepRoleBId: string;
let foreignUserId: string;

beforeAll(async () => {
  if (SKIP) return;
  const db = getDb();
  await db.insert(clinics).values({
    id: CLINIC, name: 'Test Clinic', slug: 'test-clinic', phone: '', email: 't@t.local',
  }).onConflictDoNothing();
  await db.insert(clinics).values({
    id: CLINIC_B, name: 'Test Clinic B', slug: 'test-clinic-b', phone: '', email: 'tb@t.local',
  }).onConflictDoNothing();
  await bootstrapActions();
  await seedRbacForClinic(CLINIC);
  await seedRbacForClinic(CLINIC_B);

  // Busca IDs dos roles após seed
  const [ownerRole] = await db.select({ id: roles.id }).from(roles)
    .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, RESERVED_ROLE_OWNER))).limit(1);
  ownerRoleId = ownerRole?.id ?? '';
  const [recepRole] = await db.select({ id: roles.id }).from(roles)
    .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, 'Recepcionista'))).limit(1);
  recepRoleId = recepRole?.id ?? '';
  const [recepRoleB] = await db.select({ id: roles.id }).from(roles)
    .where(and(eq(roles.clinicId, CLINIC_B), eq(roles.name, 'Recepcionista'))).limit(1);
  recepRoleBId = recepRoleB?.id ?? '';

  const u = Date.now();
  ownerUserId = `00000000-0000-0000-0000-00000000${String(u).slice(-4)}`;
  recepUserId = `00000000-0000-0000-0000-00000000${String(u + 1).slice(-4)}`;

  await db.insert(users).values([
    { id: ownerUserId, clinicId: CLINIC, email: `rbac-owner+${u}@t.local`, name: 'Rbac Owner', role: 'owner', isActive: true },
    { id: recepUserId, clinicId: CLINIC, email: `rbac-recep+${u}@t.local`, name: 'Rbac Recep', role: 'receptionist', isActive: true },
  ]).onConflictDoNothing();
  await db.insert(userClinicAccess).values([
    { userId: ownerUserId, clinicId: CLINIC, roleId: ownerRoleId },
    { userId: ownerUserId, clinicId: CLINIC_B, roleId: recepRoleBId },
    { userId: recepUserId, clinicId: CLINIC, roleId: recepRoleId },
  ]).onConflictDoNothing();
});

afterAll(async () => {
  if (SKIP) return;
  const db = getDb();
  await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, ownerUserId));
  await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, recepUserId));
  if (foreignUserId) await db.delete(userPermissionOverrides).where(eq(userPermissionOverrides.userId, foreignUserId));
  if (foreignUserId) await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, foreignUserId));
  if (foreignUserId) await db.delete(users).where(eq(users.id, foreignUserId));
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
    expect(result.can('crm:view')).toBe(true);
  });

  it('Owner obtém bypass dentro da instância mas não master-only perms', async () => {
    const result = await resolveAccess(ownerUserId, CLINIC, drizzleRbacRepo);

    expect(result.role).toBe('owner');
    expect(result.can('core:manage_users')).toBe(true);
    expect(result.can('master:delete_system')).toBe(false);
  });

  it('resolves the same identity with the role of the active clinic', async () => {
    const result = await resolveAccess(ownerUserId, CLINIC_B, drizzleRbacRepo);

    expect(result.role).toBe('Recepcionista');
    expect(result.can('core:manage_users')).toBe(false);
    expect(result.can('operacional:view')).toBe(true);
  });

  it('fails closed for expired and revoked memberships', async () => {
    const db = getDb();
    try {
      await db.update(userClinicAccess).set({ expiresAt: new Date(Date.now() - 1000), revokedAt: null })
        .where(and(eq(userClinicAccess.userId, ownerUserId), eq(userClinicAccess.clinicId, CLINIC_B)));
      expect((await resolveAccess(ownerUserId, CLINIC_B, drizzleRbacRepo)).role).toBeNull();

      await db.update(userClinicAccess).set({ expiresAt: null, revokedAt: new Date() })
        .where(and(eq(userClinicAccess.userId, ownerUserId), eq(userClinicAccess.clinicId, CLINIC_B)));
      expect((await resolveAccess(ownerUserId, CLINIC_B, drizzleRbacRepo)).role).toBeNull();
    } finally {
      await db.update(userClinicAccess).set({ expiresAt: null, revokedAt: null })
        .where(and(eq(userClinicAccess.userId, ownerUserId), eq(userClinicAccess.clinicId, CLINIC_B)));
    }
  });

  it('rejects cross-clinic role access and overrides at PostgreSQL', async () => {
    const db = getDb();
    const suffix = String(Date.now()).slice(-6).padStart(6, '0');
    foreignUserId = `00000000-0000-4000-8000-000000${suffix}`;
    await db.insert(users).values({
      id: foreignUserId,
      clinicId: CLINIC,
      email: `rbac-fk-${suffix}@t.local`,
      name: 'RBAC FK User',
      role: 'receptionist',
      isActive: true,
    });

    await expect(db.insert(userClinicAccess).values({
      userId: foreignUserId,
      clinicId: CLINIC_B,
      roleId: ownerRoleId,
    })).rejects.toThrow();

    await expect(db.insert(userPermissionOverrides).values({
      userId: foreignUserId,
      clinicId: CLINIC,
      permissionKey: 'core:manage_users',
      granted: true,
    })).rejects.toThrow();
  });
});
