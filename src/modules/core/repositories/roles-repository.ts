import { getDb } from '@/lib/db/client';
import { roles, rolePermissions, permissions } from '@/modules/core/schema/rbac';
import { ActionError } from '@/core/actions/types';
import { and, eq, inArray, like } from 'drizzle-orm';
import { RESERVED_ROLE_OPERATOR } from '@/core/rbac/presets';

export interface ClinicRoleOption {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

export async function createClinicRole(input: {
  clinicId: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}) {
  const db = getDb();
  const permissionKeys = [...new Set(input.permissionKeys)];
  if (input.name.trim() === RESERVED_ROLE_OPERATOR) {
    throw new ActionError('forbidden', 'A role operacional e reservada a plataforma.');
  }
  const invalidMaster = permissionKeys.find((key) => key.startsWith('master:'));
  if (invalidMaster) {
    throw new ActionError('forbidden', 'Permissões master são reservadas à operação de plataforma.');
  }

  if (permissionKeys.length) {
    const catalog = await db
      .select({ key: permissions.key })
      .from(permissions)
      .where(inArray(permissions.key, permissionKeys));
    const allowed = new Set(catalog.map((entry) => entry.key));
    const unknown = permissionKeys.find((key) => !allowed.has(key));
    if (unknown) throw new ActionError('invalid_input', `Permissão desconhecida: ${unknown}`);
  }

  return db.transaction(async (tx) => {
    const [row] = await tx.insert(roles)
      .values({ clinicId: input.clinicId, name: input.name, description: input.description, isSystem: false })
      .returning({ id: roles.id });

    if (permissionKeys.length) {
      await tx.insert(rolePermissions).values(
        permissionKeys.map((permissionKey) => ({ roleId: row.id, permissionKey })),
      );
    }

    return { id: row.id };
  });
}

export async function hasMasterPermission(roleId: string, clinicId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ key: rolePermissions.permissionKey })
    .from(rolePermissions)
    .innerJoin(roles, and(
      eq(roles.id, rolePermissions.roleId),
      eq(roles.clinicId, clinicId),
    ))
    .where(and(
      eq(rolePermissions.roleId, roleId),
      // Avoid accepting a legacy platform permission on a role in another tenant.
      eq(roles.clinicId, clinicId),
      like(rolePermissions.permissionKey, 'master:%'),
    ))
    .limit(1);
  return Boolean(row?.key.startsWith('master:'));
}

export async function listClinicRoles(clinicId: string): Promise<ClinicRoleOption[]> {
  return getDb().select({
    id: roles.id,
    name: roles.name,
    description: roles.description,
    isSystem: roles.isSystem,
  }).from(roles).where(eq(roles.clinicId, clinicId));
}

export async function getOwnerRole(clinicId: string, ownerName: string) {
  const [row] = await getDb().select({ id: roles.id }).from(roles)
    .where(and(eq(roles.clinicId, clinicId), eq(roles.name, ownerName), eq(roles.isSystem, true)))
    .limit(1);
  return row ?? null;
}
