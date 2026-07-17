import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema/core';
import { roles, userClinicAccess } from '@/modules/core/schema/rbac';
import { and, eq } from 'drizzle-orm';

export interface ClinicUserOption {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  roleId: string | null;
  roleName: string | null;
}

export async function listClinicUsers(clinicId: string): Promise<ClinicUserOption[]> {
  return getDb().select({
    id: users.id,
    name: users.name,
    email: users.email,
    isActive: users.isActive,
    roleId: userClinicAccess.roleId,
    roleName: roles.name,
  })
    .from(users)
    .leftJoin(userClinicAccess, and(eq(userClinicAccess.userId, users.id), eq(userClinicAccess.clinicId, clinicId)))
    .leftJoin(roles, eq(roles.id, userClinicAccess.roleId))
    .where(eq(users.clinicId, clinicId));
}

export async function deactivateUser(userId: string, clinicId: string) {
  await getDb().update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.clinicId, clinicId)));
}
