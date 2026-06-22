import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as accessService from '../services/access-service';

export const deactivateUser = defineAction({
  name: 'core.deactivateUser',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Desativar usuário de uma clínica',
  input: z.object({ userId: z.string().min(1), clinicId: z.string().min(1) }),
  handler: async (input) => accessService.deactivateUser(input),
});
