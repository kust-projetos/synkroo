import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as rolesService from '../services/roles-service';

export const createRole = defineAction({
  name: 'core.createRole',
  module: 'core',
  requires: 'core:manage_users',
  label: 'Criar perfil de acesso',
  input: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    permissionKeys: z.array(z.string()).default([]),
  }).strict(),
  handler: async (input, ctx) => {
    return rolesService.createRole({ clinicId: ctx.clinicId, name: input.name, description: input.description, permissionKeys: input.permissionKeys });
  },
});
