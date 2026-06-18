import { z } from 'zod';
import { defineAction } from '@/core/actions';
import { getDb } from '@/lib/db/client';
import { roles, rolePermissions } from '@/lib/db/schema/rbac';

export const createRole = defineAction({
  name: 'core.createRole',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Criar perfil de acesso',
  input: z.object({
    clinicId: z.string().min(1), name: z.string().min(1), description: z.string().optional(),
    permissionKeys: z.array(z.string()).default([]),
  }),
  handler: async (input) => {
    const db = getDb();
    const [row] = await db.insert(roles)
      .values({ clinicId: input.clinicId, name: input.name, description: input.description, isSystem: false })
      .returning({ id: roles.id });
    if (input.permissionKeys.length) {
      await db.insert(rolePermissions).values(input.permissionKeys.map((permissionKey) => ({ roleId: row.id, permissionKey })));
    }
    return { id: row.id };
  },
});
