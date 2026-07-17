import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as rolesService from '../services/roles-service';

export const listClinicRoles = defineAction({
  name: 'core.listClinicRoles',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Listar perfis da clínica',
  input: z.object({}),
  handler: async (_input, ctx) => rolesService.listClinicRoles(ctx.clinicId),
});
