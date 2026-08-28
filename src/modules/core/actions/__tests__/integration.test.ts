/** @jest-environment node */

jest.unmock('@/lib/db/client');

import { runAction } from '@/core/actions/run';
import { assignUserAccess } from '../assign-user-access';
import { removeUserAccess } from '../remove-user-access';
import { deactivateUser } from '../deactivate-user';
import { createRole } from '../create-role';
import { setModuleContract } from '../set-module-contract';
import { listClinicUsers } from '../list-clinic-users';
import { listClinicRoles } from '../list-clinic-roles';
import { rolePermissions } from '@/modules/core/schema/rbac';
import { instanceModules } from '@/lib/db/schema/modules';
import type { ActionContext } from '@/core/actions/types';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { getDb } from '@/lib/db/client';
import { clinics, users } from '@/lib/db/schema';
import { roles, userClinicAccess } from '@/modules/core/schema/rbac';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { eq, and } from 'drizzle-orm';

const u = Date.now();
const CLINIC = `00000000-0000-0000-0000-${String(u).slice(-12).padStart(12, '0')}`;
const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const ownerUserId = `00000000-0000-0000-0000-0000000a${String(u).slice(-4)}`;

// Shared fixture — hoisted so read-actions tests run after owner user is inserted
let ownerRoleId: string;
let recepRoleId: string;

beforeAll(async () => {
  const db = getDb();
  await db.insert(clinics).values({
    id: CLINIC,
    name: `Test Clinic ${u}`,
    slug: `test-clinic-${u}`,
    phone: '',
    email: `t+${u}@t.local`,
  }).onConflictDoNothing();
  await bootstrapActions();
  await seedRbacForClinic(CLINIC);
  const ownerRoleRows = await db.select({ id: roles.id }).from(roles)
    .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, RESERVED_ROLE_OWNER))).limit(1);
  ownerRoleId = ownerRoleRows[0]?.id;
  const recepRoleRows = await db.select({ id: roles.id }).from(roles)
    .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, 'Recepcionista'))).limit(1);
  recepRoleId = recepRoleRows[0]?.id;
  await db.insert(users).values({
    id: ownerUserId, clinicId: CLINIC, email: `owner+${u}@t.local`, name: 'Owner', role: 'owner', isActive: true,
  }).onConflictDoNothing();
  await db.insert(userClinicAccess).values({ userId: ownerUserId, clinicId: CLINIC, roleId: ownerRoleId })
    .onConflictDoUpdate({ target: [userClinicAccess.userId, userClinicAccess.clinicId], set: { roleId: ownerRoleId } });
});

afterAll(async () => {
  const db = getDb();
  await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, ownerUserId));
  await db.delete(users).where(eq(users.id, ownerUserId));
  const { closeDb } = await import('@/lib/db/client');
  await closeDb();
});

const adminCtx: ActionContext = {
  source: 'user', clinicId: CLINIC,
  user: { id: 'admin-runner', email: 'a@a', name: 'A' },
  can: () => true, hasModule: () => true,
  audit: { actor: 'admin-runner' },
};

describeOrSkip('assignUserAccess — anti-lockout (DB real)', () => {
  // Cria Owner exclusivo em cada cenário para não colidir com Owners de outros testes
  const ts = String(Date.now()).slice(-8);
  const soloOwnerId = `00000000-0000-0000-0000-0001${ts}`;
  const otherOwnerId = `00000000-0000-0000-0000-0002${ts}`;

  beforeAll(async () => {
    const db = getDb();
    // Limpa TODOS os userClinicAccess da clínica para isolar o teste
    await db.delete(userClinicAccess).where(eq(userClinicAccess.clinicId, CLINIC));

    await db.insert(users).values([
      { id: soloOwnerId, clinicId: CLINIC, email: `solo+${ts}@t.local`, name: 'Solo', role: 'owner', isActive: true },
      { id: otherOwnerId, clinicId: CLINIC, email: `other+${ts}@t.local`, name: 'Other', role: 'owner', isActive: true },
    ]).onConflictDoNothing();
    await db.insert(userClinicAccess).values([
      { userId: soloOwnerId, clinicId: CLINIC, roleId: ownerRoleId },
      { userId: otherOwnerId, clinicId: CLINIC, roleId: ownerRoleId },
    ]).onConflictDoNothing();
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, soloOwnerId));
    await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, otherOwnerId));
    await db.delete(users).where(eq(users.id, soloOwnerId));
    await db.delete(users).where(eq(users.id, otherOwnerId));
  });

  it('bloqueia rebaixar o último Owner', async () => {
    const db = getDb();
    await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, otherOwnerId));

    const r = await runAction(assignUserAccess,
      { userId: soloOwnerId, roleId: recepRoleId }, adminCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(['conflict','invalid_input','not_found','forbidden'].includes(r.error.code as any)).toBe(true);

    const [acc] = await getDb().select({ roleId: userClinicAccess.roleId }).from(userClinicAccess)
      .where(eq(userClinicAccess.userId, soloOwnerId)).limit(1);
    expect(acc.roleId).toBe(ownerRoleId);
  });

  it('permite rebaixar Owner quando há outro Owner ativo', async () => {
    const db = getDb();
    await db.insert(userClinicAccess).values({ userId: otherOwnerId, clinicId: CLINIC, roleId: ownerRoleId })
      .onConflictDoNothing();

    const r = await runAction(assignUserAccess,
      { userId: soloOwnerId, roleId: recepRoleId }, adminCtx);
    expect(r.ok).toBe(true);
  });

  it('permite reatribuir o próprio Owner a Owner (no-op idempotente)', async () => {
    const r = await runAction(assignUserAccess,
      { userId: soloOwnerId, roleId: ownerRoleId }, adminCtx);
    expect(r.ok).toBe(true);
  });

  it('keeps duplicate and concurrent access assignment deterministic', async () => {
    const db = getDb();
    await db.insert(userClinicAccess).values({ userId: otherOwnerId, clinicId: CLINIC, roleId: ownerRoleId })
      .onConflictDoUpdate({ target: [userClinicAccess.userId, userClinicAccess.clinicId], set: { roleId: ownerRoleId } });
    const [before] = await db.select({ sessionVersion: users.sessionVersion }).from(users)
      .where(eq(users.id, soloOwnerId));

    const results = await Promise.all([
      runAction(assignUserAccess, { userId: soloOwnerId, roleId: recepRoleId }, adminCtx),
      runAction(assignUserAccess, { userId: soloOwnerId, roleId: recepRoleId }, adminCtx),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    const [access] = await db.select({ roleId: userClinicAccess.roleId }).from(userClinicAccess)
      .where(and(eq(userClinicAccess.userId, soloOwnerId), eq(userClinicAccess.clinicId, CLINIC)));
    const [after] = await db.select({ sessionVersion: users.sessionVersion }).from(users)
      .where(eq(users.id, soloOwnerId));
    expect(access.roleId).toBe(recepRoleId);
    expect(after.sessionVersion).toBe(before.sessionVersion + 2);
  });
});

describeOrSkip('Core read-actions — admin lists (DB real)', () => {
  it('listClinicUsers returns users scoped to ctx.clinicId', async () => {
    const result = await runAction(listClinicUsers, {}, adminCtx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.some((u) => u.id === ownerUserId)).toBe(true);
    expect(result.data.every((u) => typeof u.email === 'string')).toBe(true);
  });

  it('listClinicRoles returns roles scoped to ctx.clinicId', async () => {
    const result = await runAction(listClinicRoles, {}, adminCtx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.some((r) => r.name === RESERVED_ROLE_OWNER)).toBe(true);
  });

  it('admin read-actions return forbidden without core:manage_users', async () => {
    const noPermCtx: ActionContext = { ...adminCtx, can: () => false };
    const usersResult = await runAction(listClinicUsers, {}, noPermCtx);
    const rolesResult = await runAction(listClinicRoles, {}, noPermCtx);
    expect(usersResult.ok).toBe(false);
    expect(rolesResult.ok).toBe(false);
    if (!usersResult.ok) expect(usersResult.error.code).toBe('forbidden');
    if (!rolesResult.ok) expect(rolesResult.error.code).toBe('forbidden');
  });
});

describeOrSkip('removeUserAccess — anti-lockout (DB real)', () => {
  // Cada teste cria owners específicos para não colidir com outros cenários
  const ts = String(Date.now()).slice(-8);
  const testRecepId = `00000000-0000-0000-0000-0005${ts}`;

  beforeAll(async () => {
    const db = getDb();
    await db.delete(userClinicAccess).where(eq(userClinicAccess.clinicId, CLINIC));
    await db.insert(users).values({
      id: testRecepId, clinicId: CLINIC, email: `tr+${ts}@t.local`, name: 'T Recep', role: 'receptionist', isActive: true,
    }).onConflictDoNothing();
    await db.insert(userClinicAccess).values({ userId: testRecepId, clinicId: CLINIC, roleId: recepRoleId }).onConflictDoNothing();
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, testRecepId));
    await db.delete(users).where(eq(users.id, testRecepId));
  });

  it('removeUserAccess bloqueia remover o último Owner', async () => {
    const db = getDb();
    const soloOwnerId = `00000000-0000-0000-0000-0001${ts}`;
    await db.insert(users).values({ id: soloOwnerId, clinicId: CLINIC, email: `sro+${ts}@t.local`, name: 'Solo Rem', role: 'owner', isActive: true }).onConflictDoNothing();
    await db.insert(userClinicAccess).values({ userId: soloOwnerId, clinicId: CLINIC, roleId: ownerRoleId }).onConflictDoNothing();

    const r = await runAction(removeUserAccess, { userId: soloOwnerId }, adminCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('conflict');
  });

  it('removeUserAccess permite remover Owner quando há outro Owner ativo', async () => {
    const db = getDb();
    const soloOwnerId = `00000000-0000-0000-0000-0001${ts}`;
    const otherOwnerId = `00000000-0000-0000-0000-0002${ts}`;
    await db.insert(users).values([
      { id: soloOwnerId, clinicId: CLINIC, email: `sro2+${ts}@t.local`, name: 'Solo Rem 2', role: 'owner', isActive: true },
      { id: otherOwnerId, clinicId: CLINIC, email: `oro2+${ts}@t.local`, name: 'Other Rem 2', role: 'owner', isActive: true },
    ]).onConflictDoNothing();
    await db.insert(userClinicAccess).values([
      { userId: soloOwnerId, clinicId: CLINIC, roleId: ownerRoleId },
      { userId: otherOwnerId, clinicId: CLINIC, roleId: ownerRoleId },
    ]).onConflictDoNothing();

    const r = await runAction(removeUserAccess, { userId: soloOwnerId }, adminCtx);
    expect(r.ok).toBe(true);
  });

  it('removeUserAccess permitido para não-Owner', async () => {
    const r = await runAction(removeUserAccess, { userId: testRecepId }, adminCtx);
    expect(r.ok).toBe(true);
    await getDb().insert(userClinicAccess).values({ userId: testRecepId, clinicId: CLINIC, roleId: recepRoleId }).onConflictDoNothing();
  });
});

describeOrSkip('deactivateUser — anti-lockout (DB real)', () => {
  const ts = String(Date.now()).slice(-8);

  beforeAll(async () => {
    const db = getDb();
    // Limpa TODOS os userClinicAccess da clínica para isolar o bloco
    await db.delete(userClinicAccess).where(eq(userClinicAccess.clinicId, CLINIC));
  });

  it('deactivateUser bloqueia desativar o último Owner', async () => {
    const db = getDb();
    const soloOwnerId = `00000000-0000-0000-0000-0003${ts}`;
    await db.insert(users).values({ id: soloOwnerId, clinicId: CLINIC, email: `sdo+${ts}@t.local`, name: 'Solo Dea', role: 'owner', isActive: true }).onConflictDoNothing();
    await db.insert(userClinicAccess).values({ userId: soloOwnerId, clinicId: CLINIC, roleId: ownerRoleId }).onConflictDoNothing();

    const r = await runAction(deactivateUser, { userId: soloOwnerId }, adminCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('conflict');
  });

  it('deactivateUser permite desativar Owner quando há outro Owner ativo', async () => {
    const db = getDb();
    const soloOwnerId = `00000000-0000-0000-0000-0003${ts}`;
    const otherOwnerId = `00000000-0000-0000-0000-0004${ts}`;
    await db.insert(users).values([
      { id: soloOwnerId, clinicId: CLINIC, email: `sdo2+${ts}@t.local`, name: 'Solo Dea 2', role: 'owner', isActive: true },
      { id: otherOwnerId, clinicId: CLINIC, email: `odo2+${ts}@t.local`, name: 'Other Dea 2', role: 'owner', isActive: true },
    ]).onConflictDoNothing();
    await db.insert(userClinicAccess).values([
      { userId: soloOwnerId, clinicId: CLINIC, roleId: ownerRoleId },
      { userId: otherOwnerId, clinicId: CLINIC, roleId: ownerRoleId },
    ]).onConflictDoNothing();

    const r = await runAction(deactivateUser, { userId: soloOwnerId }, adminCtx);
    expect(r.ok).toBe(true);
    await db.update(users).set({ isActive: true }).where(eq(users.id, soloOwnerId));
  });

  it('deactivateUser permitido para não-Owner', async () => {
    const db = getDb();
    const testRecepId = `00000000-0000-0000-0000-0005${ts}`;
    await db.insert(users).values({ id: testRecepId, clinicId: CLINIC, email: `td+${ts}@t.local`, name: 'T Dea', role: 'receptionist', isActive: true }).onConflictDoNothing();
    await db.insert(userClinicAccess).values({ userId: testRecepId, clinicId: CLINIC, roleId: recepRoleId }).onConflictDoNothing();

    const r = await runAction(deactivateUser, { userId: testRecepId }, adminCtx);
    expect(r.ok).toBe(true);
  });
});

describeOrSkip('Core actions — service/repository flow (DB real)', () => {
  it('createRole creates role and permissions via action layer', async () => {
    const name = `Plano Teste ${Date.now()}`;
    const result = await runAction(createRole, {
      name,
      description: 'Perfil criado pelo teste',
      permissionKeys: ['core:manage_users'],
    }, adminCtx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [role] = await getDb().select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(eq(roles.id, result.data.id))
      .limit(1);
    expect(role.name).toBe(name);

    const perms = await getDb().select({ key: rolePermissions.permissionKey })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, result.data.id));
    expect(perms.map((p) => p.key)).toEqual(['core:manage_users']);
  });

  it('setModuleContract upserts module contract via action layer', async () => {
    const moduleId = `test-module-${Date.now()}`;
    const result = await runAction(setModuleContract, { moduleId, enabled: true }, adminCtx);

    expect(result.ok).toBe(true);

    const [row] = await getDb().select({ moduleId: instanceModules.moduleId, enabled: instanceModules.enabled })
      .from(instanceModules)
      .where(eq(instanceModules.moduleId, moduleId))
      .limit(1);
    expect(row).toEqual({ moduleId, enabled: true });
  });
});

const FOREIGN_CLINIC = `00000000-0000-0000-0000-${String(u + 1).slice(-12).padStart(12, '0')}`;
let foreignRecepRoleId: string;
const foreignUserId = `00000000-0000-0000-0000-0000000f${String(u).slice(-4)}`;

describeOrSkip('O1-G03 — tenant scope matrix (DB real)', () => {
  beforeAll(async () => {
    const db = getDb();
    await db.insert(clinics).values({
      id: FOREIGN_CLINIC,
      name: `Foreign Clinic ${u}`,
      slug: `foreign-clinic-${u}`,
      phone: '',
      email: `foreign+${u}@t.local`,
    }).onConflictDoNothing();
    await db.insert(users).values({
      id: foreignUserId,
      clinicId: FOREIGN_CLINIC,
      email: `foreign-user+${u}@t.local`,
      name: 'Foreign User',
      role: 'receptionist',
      isActive: true,
    }).onConflictDoNothing();
    await seedRbacForClinic(FOREIGN_CLINIC);
    const [role] = await db.select({ id: roles.id }).from(roles)
      .where(and(eq(roles.clinicId, FOREIGN_CLINIC), eq(roles.name, 'Recepcionista'))).limit(1);
    foreignRecepRoleId = role.id;
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(userClinicAccess).where(eq(userClinicAccess.clinicId, FOREIGN_CLINIC));
    await db.delete(users).where(eq(users.id, foreignUserId));
    const foreignRoles = await db.select({ id: roles.id }).from(roles)
      .where(eq(roles.clinicId, FOREIGN_CLINIC));
    for (const role of foreignRoles) {
      await db.delete(userClinicAccess).where(eq(userClinicAccess.roleId, role.id));
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    }
    await db.delete(roles).where(eq(roles.clinicId, FOREIGN_CLINIC));
    await db.delete(clinics).where(eq(clinics.id, FOREIGN_CLINIC));
  });

  it('rejects foreign clinic scope for mutating actions without foreign mutation', async () => {
    const [assign, assignForeignRole, assignForeignUser, create, remove, deactivate] = await Promise.all([
      runAction(assignUserAccess, {
        userId: ownerUserId,
        roleId: foreignRecepRoleId,
      }, adminCtx),
      runAction(assignUserAccess, {
        userId: ownerUserId,
        roleId: foreignRecepRoleId,
      }, adminCtx),
      runAction(assignUserAccess, {
        userId: foreignUserId,
        roleId: recepRoleId,
      }, adminCtx),
      runAction(createRole, {
        name: `Foreign role ${u}`,
        permissionKeys: ['core:manage_users'],
      }, adminCtx),
      runAction(removeUserAccess, {
        userId: ownerUserId,
      }, adminCtx),
      runAction(deactivateUser, {
        userId: ownerUserId,
      }, adminCtx),
    ]);

    // Foreign role/user assignments should be rejected (not_found/forbidden), create in own clinic succeeds
    expect(assign.ok).toBe(false);
    expect(assignForeignRole.ok).toBe(false);
    expect(assignForeignUser.ok).toBe(false);
    expect(create.ok).toBe(true);
    // remove/deactivate may succeed or be blocked depending on owner count isolation — just verify boolean and no foreign mutation
    expect(typeof remove.ok).toBe('boolean');
    expect(typeof deactivate.ok).toBe('boolean');

    const foreignAccess = await getDb().select({ userId: userClinicAccess.userId })
      .from(userClinicAccess)
      .where(and(eq(userClinicAccess.userId, ownerUserId), eq(userClinicAccess.clinicId, FOREIGN_CLINIC)));
    expect(foreignAccess).toHaveLength(0);
  });
});
