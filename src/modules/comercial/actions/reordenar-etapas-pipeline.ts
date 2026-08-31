import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { reorderStages, findStageById } from '../repositories/pipeline-repository';

export const reordenarEtapasPipeline = defineAction({
  name: 'comercial.reordenarEtapasPipeline',
  module: 'comercial',
  requires: 'comercial:manage_pipeline',
  label: 'Reordenar etapas pipeline',
  input: z.object({
    stages: z.array(z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
    })),
  }),
  handler: async (input, ctx: ActionContext) => {
    for (const s of input.stages) {
      const stage = await findStageById(ctx.clinicId, s.id);
      if (!stage) throw new ActionError('not_found', `Etapa ${s.id} não encontrada.`);
    }
    const results = await reorderStages(ctx.clinicId, input.stages);
    return { updated: results.length };
  },
});
