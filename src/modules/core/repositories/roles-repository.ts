import { getDb } from '@/lib/db/client';
import { roles, rolePermissions } from '@/modules/core/schema/rbac';
import { and, eq } from 'drizzle-orm';

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
  const [row] = await db.insert(roles)
    .values({ clinicId: input.clinicId, name: input.name, description: input.description, isSystem: false })
    .returning({ id: roles.id });

  if (input.permissionKeys.length) {
    await db.insert(rolePermissions).values(
      input.permissionKeys.map((permissionKey) => ({ roleId: row.id, permissionKey })),
    );
  }

  return { id: row.id };
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
