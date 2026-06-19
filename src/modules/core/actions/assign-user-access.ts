import { z } from 'zod';
import { defineAction } from '@/core/actions';
import { getDb } from '@/lib/db/client';
import { userClinicAccess } from '@/lib/db/schema/rbac';

export const assignUserAccess = defineAction({
  name: 'core.assignUserAccess',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Conceder acesso de usuário a uma clínica',
  input: z.object({ userId: z.string().min(1), clinicId: z.string().min(1), roleId: z.string().min(1) }),
  handler: async (input) => {
    await getDb().insert(userClinicAccess)
      .values({ userId: input.userId, clinicId: input.clinicId, roleId: input.roleId })
      .onConflictDoUpdate({ target: [userClinicAccess.userId, userClinicAccess.clinicId], set: { roleId: input.roleId } });
    return { ok: true };
  },
});
