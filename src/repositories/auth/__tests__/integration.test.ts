/** @jest-environment node */

// Integration: usa DB real — desativa o mock do jest.setup.ts
jest.unmock('@/lib/db/client');



import { createUserWithClinic } from '../index';
import { getDb } from '@/lib/db/client';
import { clinics, users, userCredentials } from '@/lib/db/schema';
import { roles, rolePermissions, userClinicAccess } from '@/modules/core/schema/rbac';
import { resolveAccess } from '@/core/rbac/resolve';
import { drizzleRbacRepo } from '@/core/rbac/repository';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { eq, and } from 'drizzle-orm';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

describeOrSkip('Signup — provisiona RBAC (DB real)', () => {
  const unique = Date.now();
  const email = `owner+${unique}@signup-test.local`;
  const clinicName = `Signup Test ${unique}`;
  let clinicId: string;
  let ownerId: string;

  afterAll(async () => {
    const db = getDb();
    // Limpeza explícita em ordem de dependência (FKs).
    if (clinicId) {
      await db.delete(userClinicAccess).where(eq(userClinicAccess.clinicId, clinicId));
      await db.delete(userCredentials).where(eq(userCredentials.userId, ownerId));
      await db.delete(users).where(eq(users.clinicId, clinicId));
      const roleRows = await db.select({ id: roles.id }).from(roles).where(eq(roles.clinicId, clinicId));
      for (const r of roleRows) await db.delete(rolePermissions).where(eq(rolePermissions.roleId, r.id));
      await db.delete(roles).where(eq(roles.clinicId, clinicId));
      await db.delete(clinics).where(eq(clinics.id, clinicId));
    }
    const { closeDb } = await import('@/lib/db/client');
    await closeDb();
  });

  it('cria clínica com perfis de sistema e dono com acesso Owner', async () => {
    const profile = await createUserWithClinic({
      email, password: 'senha-forte-123', name: 'Dr. Owner', clinicName,
    });
    ownerId = profile.id;
    clinicId = profile.clinicId;

    // 1. Perfis de sistema semeados (Owner + Agente + 4 presets = 6).
    const systemRoles = await getDb().select({ name: roles.name })
      .from(roles).where(and(eq(roles.clinicId, clinicId), eq(roles.isSystem, true)));
    const names = systemRoles.map((r) => r.name);
    expect(names).toContain(RESERVED_ROLE_OWNER);
    expect(names).toContain('Agente');
    expect(systemRoles.length).toBeGreaterThanOrEqual(6);

    // 2. Dono tem exatamente um acesso, com o role Owner.
    const [ownerRole] = await getDb().select({ id: roles.id }).from(roles)
      .where(and(eq(roles.clinicId, clinicId), eq(roles.name, RESERVED_ROLE_OWNER))).limit(1);
    const access = await getDb().select().from(userClinicAccess)
      .where(eq(userClinicAccess.userId, ownerId));
    expect(access).toHaveLength(1);
    expect(access[0].roleId).toBe(ownerRole.id);

    // 3. Prova do fim do lockout: o dono pode gerir usuários.
    const resolved = await resolveAccess(ownerId, clinicId, drizzleRbacRepo);
    expect(resolved.can('core:manage_users')).toBe(true);
  });
});
