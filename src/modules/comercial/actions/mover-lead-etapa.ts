import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { assertClinicScope } from '@/core/actions/tenant-scope';
import { moverLeadEtapa } from '../services/pipeline-service';

export const moverLeadEtapaAction = defineAction({
  name: 'comercial.moverLeadEtapa',
  module: 'comercial',
  requires: 'comercial:manage_pipeline',
  label: 'Mover lead de etapa',
  input: z.object({
    leadId: z.string().uuid(),
    clinicId: z.string().uuid(),
    stageId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    assertClinicScope(input.clinicId, ctx);
    const result = await moverLeadEtapa(input);
    if (!result) throw new ActionError('not_found', 'Lead ou etapa não encontrado.');
    return result;
  },
});
