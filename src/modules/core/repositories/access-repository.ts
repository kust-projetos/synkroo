import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema/core';
import { userClinicAccess } from '@/modules/core/schema/rbac';
import { and, eq, sql } from 'drizzle-orm';

export async function getUserClinicAccess(userId: string, clinicId: string) {
  const [row] = await getDb().select({ roleId: userClinicAccess.roleId })
    .from(userClinicAccess)
    .where(and(eq(userClinicAccess.userId, userId), eq(userClinicAccess.clinicId, clinicId)))
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
        set: { roleId: input.roleId },
      });
    await tx.update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() })
      .where(eq(users.id, input.userId));
  });
}

export async function removeUserAccess(userId: string, clinicId: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(userClinicAccess)
      .where(and(eq(userClinicAccess.userId, userId), eq(userClinicAccess.clinicId, clinicId)));
    await tx.update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() })
      .where(eq(users.id, userId));
  });
}
