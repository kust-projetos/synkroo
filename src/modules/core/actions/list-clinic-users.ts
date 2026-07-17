import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as accessService from '../services/access-service';

export const listClinicUsers = defineAction({
  name: 'core.listClinicUsers',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Listar usuários da clínica',
  input: z.object({}),
  handler: async (_input, ctx) => accessService.listClinicUsers(ctx.clinicId),
});
