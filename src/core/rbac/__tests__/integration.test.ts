/** @jest-environment node */

jest.unmock('@/lib/db/client');
process.env.DATABASE_URL = 'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

import { resolveAccess } from '../resolve';
import { drizzleRbacRepo } from '@/core/rbac/repository';
import { seedRbacForClinic } from '@/core/rbac/seed';
import { getDb } from '@/lib/db/client';
import { clinics, users } from '@/lib/db/schema';
import { roles, userClinicAccess } from '@/modules/core/schema/rbac';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';
import { eq, and } from 'drizzle-orm';

const CLINIC = '00000000-0000-0000-0000-000000000001';
const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

let ownerUserId: string;
let recepUserId: string;
let ownerRoleId: string;
let recepRoleId: string;

beforeAll(async () => {
  const db = getDb();
  await db.insert(clinics).values({
    id: CLINIC, name: 'Test Clinic', slug: 'test-clinic', phone: '', email: 't@t.local',
  }).onConflictDoNothing();
  await seedRbacForClinic(CLINIC);

  const ownerRoleRows = await db.select({ id: roles.id }).from(roles)
    .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, RESERVED_ROLE_OWNER))).limit(1);
  ownerRoleId = ownerRoleRows[0]?.id;

  const recepRoleRows = await db.select({ id: roles.id }).from(roles)
    .where(and(eq(roles.clinicId, CLINIC), eq(roles.name, 'Recepcionista'))).limit(1);
  recepRoleId = recepRoleRows[0]?.id;

  // crypto.randomUUID() gives a valid v4 UUID; timestamp suffix for uniqueness
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
  const db = getDb();
  await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, ownerUserId));
  await db.delete(userClinicAccess).where(eq(userClinicAccess.userId, recepUserId));
  await db.delete(users).where(eq(users.id, ownerUserId));
  await db.delete(users).where(eq(users.id, recepUserId));
  const { closeDb } = await import('@/lib/db/client');
  await closeDb();
});

describeOrSkip('resolveAccess — inactive users blocked', () => {
  it('usuário inativo obtém can=never', async () => {
    const db = getDb();
    // desativa o recepcionista
    await db.update(users).set({ isActive: false }).where(eq(users.id, recepUserId));

    const result = await resolveAccess(recepUserId, CLINIC, drizzleRbacRepo);

    expect(result.can('comercial:view')).toBe(false);
    expect(result.can('core:manage_users')).toBe(false);
    expect(result.role).toBeNull();

    // reativa para não poluir os outros testes
    await db.update(users).set({ isActive: true }).where(eq(users.id, recepUserId));
  });

  it('usuário ativo com Recepcionista obtém permissões corretas', async () => {
    const result = await resolveAccess(recepUserId, CLINIC, drizzleRbacRepo);

    expect(result.role).toBe('Recepcionista');
    // Recepcionista tem comercial:view (extraKeys) + operacional:* do preset
    // Usa comercial:view que vem de extraKeys independente do catálogo
    expect(result.can('comercial:view')).toBe(true);
    expect(result.can('core:manage_users')).toBe(false);
  });

  it('Owner obtém bypass total exceto master:', async () => {
    const result = await resolveAccess(ownerUserId, CLINIC, drizzleRbacRepo);

    expect(result.role).toBe('owner');
    expect(result.can('core:manage_users')).toBe(true);
    expect(result.can('master:delete_system')).toBe(false);
  });
});
