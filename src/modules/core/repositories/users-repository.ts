import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema/core';
import { roles, userClinicAccess, userPermissionOverrides } from '@/modules/core/schema/rbac';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';

export interface ClinicUserOption {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  isActive: boolean;
  roleId: string | null;
  roleName: string | null;
}

export async function listClinicUsers(clinicId: string): Promise<ClinicUserOption[]> {
  return getDb().select({
    id: users.id,
    name: users.name,
    email: users.email,
    phone: users.phone,
    isActive: users.isActive,
    roleId: userClinicAccess.roleId,
    roleName: roles.name,
  })
    .from(userClinicAccess)
    .innerJoin(users, eq(users.id, userClinicAccess.userId))
    .innerJoin(roles, and(
      eq(roles.id, userClinicAccess.roleId),
      eq(roles.clinicId, userClinicAccess.clinicId),
    ))
    .where(and(
      eq(userClinicAccess.clinicId, clinicId),
      isNull(userClinicAccess.revokedAt),
      or(isNull(userClinicAccess.expiresAt), gt(userClinicAccess.expiresAt, new Date())),
    ));
}

export async function getUserInClinic(userId: string, clinicId: string) {
  const [row] = await getDb().select({ id: users.id })
    .from(userClinicAccess)
    .innerJoin(users, eq(users.id, userClinicAccess.userId))
    .where(and(
      eq(userClinicAccess.userId, userId),
      eq(userClinicAccess.clinicId, clinicId),
      isNull(userClinicAccess.revokedAt),
      or(isNull(userClinicAccess.expiresAt), gt(userClinicAccess.expiresAt, new Date())),
    ))
    .limit(1);
  return row ?? null;
}

export async function deactivateUser(userId: string, clinicId: string) {
  const db = getDb();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(userClinicAccess)
      .set({ revokedAt: now })
      .where(and(
        eq(userClinicAccess.userId, userId),
        eq(userClinicAccess.clinicId, clinicId),
        isNull(userClinicAccess.revokedAt),
      ));
    await tx.delete(userPermissionOverrides)
      .where(and(
        eq(userPermissionOverrides.userId, userId),
        eq(userPermissionOverrides.clinicId, clinicId),
      ));
    await tx.update(users)
      .set({
        sessionVersion: sql`${users.sessionVersion} + 1`,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
  });
}
