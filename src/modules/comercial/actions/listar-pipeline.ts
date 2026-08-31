import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listPipeline } from '../repositories/pipeline-repository';

export const listarPipeline = defineAction({
  name: 'comercial.listarPipeline',
  module: 'comercial',
  requires: 'comercial:view',
  label: 'Listar pipeline',
  input: z.object({}),
  handler: async (_input, ctx: ActionContext) => {
    const stages = await listPipeline(ctx.clinicId);
    return { stages };
  },
});
