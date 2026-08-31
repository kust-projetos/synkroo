import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { moverLeadEtapa } from '../services/pipeline-service';

export const moverLeadEtapaAction = defineAction({
  name: 'comercial.moverLeadEtapa',
  module: 'comercial',
  requires: 'comercial:manage_pipeline',
  label: 'Mover lead de etapa',
  input: z.object({
    leadId: z.string().uuid(),
    stageId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const result = await moverLeadEtapa({ ...input, clinicId: ctx.clinicId });
    if (!result) throw new ActionError('not_found', 'Lead ou etapa não encontrado.');
    return result;
  },
});
