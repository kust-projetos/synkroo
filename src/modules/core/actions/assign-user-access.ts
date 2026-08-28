import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as accessService from '../services/access-service';
import { assertClinicScope } from '@/core/actions/tenant-scope';

export const assignUserAccess = defineAction({
  name: 'core.assignUserAccess',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Conceder acesso de usuário a uma clínica',
  input: z.object({ userId: z.string().min(1), roleId: z.string().min(1) }),
  handler: async (input, ctx) => {
    return accessService.assignUserAccess({ userId: input.userId, clinicId: ctx.clinicId, roleId: input.roleId });
  },
});
