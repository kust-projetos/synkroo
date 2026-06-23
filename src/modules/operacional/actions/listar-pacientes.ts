import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listarPacientes as service } from '../services/patients-service';

export const listarPacientes = defineAction({
  name: 'operacional.listarPacientes',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Listar pacientes',
  input: z.object({
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
  handler: async (input, ctx: ActionContext) => service(ctx.clinicId, input),
});
