import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listAllLeadsWithStage } from '../repositories/leads-repository';

export const listarLeadsKanban = defineAction({
  name: 'comercial.listarLeadsKanban',
  module: 'comercial',
  requires: 'comercial:view',
  label: 'Listar leads kanban',
  input: z.object({
    stageId: z.string().uuid().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const rows = await listAllLeadsWithStage(ctx.clinicId, input.stageId);
    return { leads: rows };
  },
});
