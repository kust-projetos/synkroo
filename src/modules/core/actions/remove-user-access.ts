import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as accessService from '../services/access-service';
import { assertClinicScope } from '@/core/actions/tenant-scope';

export const removeUserAccess = defineAction({
  name: 'core.removeUserAccess',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Remover acesso de usuário a uma clínica',
  input: z.object({ userId: z.string().min(1) }),
  handler: async (input, ctx) => {
    return accessService.removeUserAccess({ userId: input.userId, clinicId: ctx.clinicId });
  },
});
