import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { createStage } from '../repositories/pipeline-repository';

export const criarEtapaPipeline = defineAction({
  name: 'comercial.criarEtapaPipeline',
  module: 'comercial',
  requires: 'comercial:manage_pipeline',
  label: 'Criar etapa pipeline',
  input: z.object({
    name: z.string().min(1),
    position: z.number().int().min(0),
    color: z.string().optional(),
    winProbability: z.number().int().min(0).max(100).optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    return createStage({ ...input, clinicId: ctx.clinicId });
  },
});
