import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as rolesService from '../services/roles-service';
import { assertClinicScope } from '@/core/actions/tenant-scope';

export const createRole = defineAction({
  name: 'core.createRole',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Criar perfil de acesso',
  input: z.object({
    clinicId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    permissionKeys: z.array(z.string()).default([]),
  }),
  handler: async (input, ctx) => {
    assertClinicScope(input.clinicId, ctx);
    return rolesService.createRole(input);
  },
});
