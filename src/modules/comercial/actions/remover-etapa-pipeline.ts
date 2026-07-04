import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { deleteStage, findStageById } from '../repositories/pipeline-repository';

export const removerEtapaPipeline = defineAction({
  name: 'comercial.removerEtapaPipeline',
  module: 'comercial',
  requires: 'comercial:manage_pipeline',
  label: 'Remover etapa pipeline',
  input: z.object({
    stageId: z.string().uuid(),
    clinicId: z.string().uuid(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const existing = await findStageById(input.clinicId, input.stageId);
    if (!existing) throw new ActionError('not_found', 'Etapa não encontrada.');

    const deleted = await deleteStage(input.clinicId, input.stageId);
    if (!deleted) throw new ActionError('not_found', 'Etapa não encontrada.');
    return { success: true };
  },
});
