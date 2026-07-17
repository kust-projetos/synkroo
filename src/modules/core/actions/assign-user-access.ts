import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as accessService from '../services/access-service';

export const assignUserAccess = defineAction({
  name: 'core.assignUserAccess',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Conceder acesso de usuário a uma clínica',
  input: z.object({ userId: z.string().min(1), clinicId: z.string().min(1), roleId: z.string().min(1) }),
  handler: async (input) => accessService.assignUserAccess(input),
});
