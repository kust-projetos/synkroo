import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { assertClinicScope } from '@/core/actions/tenant-scope';
import { updateStage, findStageById } from '../repositories/pipeline-repository';

export const atualizarEtapaPipeline = defineAction({
  name: 'comercial.atualizarEtapaPipeline',
  module: 'comercial',
  requires: 'comercial:manage_pipeline',
  label: 'Atualizar etapa pipeline',
  input: z.object({
    stageId: z.string().uuid(),
    clinicId: z.string().uuid(),
    name: z.string().optional(),
    color: z.string().optional(),
    position: z.number().int().min(0).optional(),
    winProbability: z.number().int().min(0).max(100).optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    assertClinicScope(input.clinicId, ctx);
    const existing = await findStageById(input.clinicId, input.stageId);
    if (!existing) throw new ActionError('not_found', 'Etapa não encontrada.');

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.color !== undefined) patch.color = input.color;
    if (input.position !== undefined) patch.position = input.position;
    if (input.winProbability !== undefined) patch.winProbability = input.winProbability;

    const updated = await updateStage(input.clinicId, input.stageId, patch);
    if (!updated) throw new ActionError('not_found', 'Etapa não encontrada.');
    return { id: updated.id };
  },
});
