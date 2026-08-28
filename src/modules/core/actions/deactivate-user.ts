import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as accessService from '../services/access-service';
import { assertClinicScope } from '@/core/actions/tenant-scope';

export const deactivateUser = defineAction({
  name: 'core.deactivateUser',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Desativar usuário de uma clínica',
  input: z.object({ userId: z.string().min(1) }),
  handler: async (input, ctx) => {
    return accessService.deactivateUser({ userId: input.userId, clinicId: ctx.clinicId });
  },
});
