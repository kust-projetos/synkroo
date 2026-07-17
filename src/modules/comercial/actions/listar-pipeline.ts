import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listPipeline } from '../repositories/pipeline-repository';

export const listarPipeline = defineAction({
  name: 'comercial.listarPipeline',
  module: 'comercial',
  requires: 'comercial:view',
  label: 'Listar pipeline',
  input: z.object({
    clinicId: z.string().uuid(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const stages = await listPipeline(input.clinicId);
    return { stages };
  },
});
