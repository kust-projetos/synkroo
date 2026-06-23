import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as service from '../services/campaign-service';

export const listarSegmentos = defineAction({
  name: 'followup.listarSegmentos',
  module: 'followup',
  requires: 'followup:manage_segments',
  label: 'Listar segmentos de campanhas',
  input: z.object({}),
  handler: async (_input, ctx: ActionContext) => {
    return service.listarSegmentos(ctx.clinicId);
  },
});
