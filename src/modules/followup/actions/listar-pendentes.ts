import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as service from '../services/followup-service';

export const listarPendentes = defineAction({
  name: 'followup.listarPendentes',
  module: 'followup',
  requires: 'followup:view',
  label: 'Listar follow-ups pendentes',
  input: z.object({
    type: z.enum(['post_consultation', 'return_reminder']).optional().default('post_consultation'),
  }),
  handler: async (input, ctx: ActionContext) => {
    if (input.type === 'return_reminder') {
      return service.listarRetornoPendentes(ctx.clinicId);
    }
    return service.listarPendentes(ctx.clinicId);
  },
});
