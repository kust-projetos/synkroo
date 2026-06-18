export interface ClinicAccess { roleId: string; roleName: string; isSystem: boolean; }

export interface RbacRepo {
  isMaster(userId: string): Promise<boolean>;
  getAccess(userId: string, clinicId: string): Promise<ClinicAccess | null>;
  getRolePermissions(roleId: string): Promise<string[]>;
  getOverrides(userId: string, clinicId: string): Promise<Array<{ permissionKey: string; granted: boolean }>>;
}

// ── Drizzle implementation ──

import { getDb } from '@/lib/db/client';
import { and, eq } from 'drizzle-orm';
import { users } from '@/lib/db/schema/core';
import { roles, rolePermissions, userClinicAccess, userPermissionOverrides } from '@/lib/db/schema/rbac';

export const drizzleRbacRepo: RbacRepo = {
  async isMaster(userId) {
    const r = await getDb().select({ isMaster: users.isMaster }).from(users).where(eq(users.id, userId)).limit(1);
    return r[0]?.isMaster ?? false;
  },
  async getAccess(userId, clinicId) {
    const r = await getDb()
      .select({ roleId: roles.id, roleName: roles.name, isSystem: roles.isSystem })
      .from(userClinicAccess)
      .innerJoin(roles, eq(roles.id, userClinicAccess.roleId))
      .where(and(eq(userClinicAccess.userId, userId), eq(userClinicAccess.clinicId, clinicId)))
      .limit(1);
    return r[0] ?? null;
  },
  async getRolePermissions(roleId) {
    const r = await getDb().select({ key: rolePermissions.permissionKey }).from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    return r.map((x) => x.key);
  },
  async getOverrides(userId, clinicId) {
    return getDb().select({ permissionKey: userPermissionOverrides.permissionKey, granted: userPermissionOverrides.granted })
      .from(userPermissionOverrides)
      .where(and(eq(userPermissionOverrides.userId, userId), eq(userPermissionOverrides.clinicId, clinicId)));
  },
};
