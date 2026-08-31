import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema/core';
import { roles, userClinicAccess, userPermissionOverrides } from '@/modules/core/schema/rbac';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';

export async function getUserClinicAccess(userId: string, clinicId: string) {
  const [row] = await getDb().select({ roleId: userClinicAccess.roleId })
    .from(userClinicAccess)
    .where(and(
      eq(userClinicAccess.userId, userId),
      eq(userClinicAccess.clinicId, clinicId),
      isNull(userClinicAccess.revokedAt),
      or(isNull(userClinicAccess.expiresAt), gt(userClinicAccess.expiresAt, new Date())),
    ))
    .limit(1);
  return row ?? null;
}

export async function getUserRoleScope(userId: string, clinicId: string, roleId: string) {
  const [row] = await getDb().select({
    userId: users.id,
    userClinicId: userClinicAccess.clinicId,
    roleClinicId: roles.clinicId,
    roleName: roles.name,
    roleIsSystem: roles.isSystem,
  })
    .from(users)
    .innerJoin(userClinicAccess, and(
      eq(userClinicAccess.userId, users.id),
      eq(userClinicAccess.clinicId, clinicId),
      isNull(userClinicAccess.revokedAt),
      or(isNull(userClinicAccess.expiresAt), gt(userClinicAccess.expiresAt, new Date())),
    ))
    .innerJoin(roles, and(eq(roles.id, roleId), eq(roles.clinicId, clinicId)))
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .limit(1);
  return row ?? null;
}

export async function countActiveUsersWithRole(clinicId: string, roleId: string): Promise<number> {
  const rows = await getDb().select({ userId: userClinicAccess.userId })
    .from(userClinicAccess)
    .innerJoin(users, eq(users.id, userClinicAccess.userId))
    .where(and(
      eq(userClinicAccess.clinicId, clinicId),
      eq(userClinicAccess.roleId, roleId),
      eq(users.isActive, true),
      isNull(userClinicAccess.revokedAt),
      or(isNull(userClinicAccess.expiresAt), gt(userClinicAccess.expiresAt, new Date())),
    ));
  return rows.length;
}

export async function upsertUserAccess(input: { userId: string; clinicId: string; roleId: string }) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(userClinicAccess)
      .values(input)
      .onConflictDoUpdate({
        target: [userClinicAccess.userId, userClinicAccess.clinicId],
        set: {
          roleId: input.roleId,
          revokedAt: null,
          expiresAt: null,
          grantReason: null,
          grantedBy: null,
        },
      });
    await tx.update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() })
      .where(eq(users.id, input.userId));
  });
}

export async function removeUserAccess(userId: string, clinicId: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(userPermissionOverrides)
      .where(and(
        eq(userPermissionOverrides.userId, userId),
        eq(userPermissionOverrides.clinicId, clinicId),
      ));
    await tx.delete(userClinicAccess)
      .where(and(eq(userClinicAccess.userId, userId), eq(userClinicAccess.clinicId, clinicId)));
    await tx.update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() })
      .where(eq(users.id, userId));
  });
}
