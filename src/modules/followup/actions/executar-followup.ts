import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as service from '../services/followup-service';

export const executarFollowup = defineAction({
  name: 'followup.executarFollowup',
  module: 'followup',
  requires: 'followup:manage_followups',
  label: 'Executar follow-up pós-consulta',
  input: z.object({
    type: z.enum(['all', 'post_consultation', 'return_reminder']).optional().default('all'),
  }),
  handler: async (input, _ctx: ActionContext) => {
    if (input.type === 'post_consultation') {
      return service.executarPostConsulta();
    }
    if (input.type === 'return_reminder') {
      return service.executarLembretesRetorno();
    }
    return service.executarAll();
  },
});
