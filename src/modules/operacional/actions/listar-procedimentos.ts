import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listarProcedimentos as service } from '../services/catalog-service';

export const listarProcedimentos = defineAction({
  name: 'operacional.listarProcedimentos',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Listar procedimentos',
  input: z.object({
    activeOnly: z.boolean().optional(),
  }),
  handler: async (input, ctx: ActionContext) =>
    service(ctx.clinicId, input),
});
