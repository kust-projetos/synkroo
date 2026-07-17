import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as service from '../services/budget-followup-service';

export const executarFollowupOrcamentos = defineAction({
  name: 'followup.executarFollowupOrcamentos',
  module: 'followup',
  requires: 'followup:manage_followups',
  label: 'Executar follow-up de orçamentos',
  input: z.object({}),
  handler: async (_input, ctx: ActionContext) => {
    return service.executarFollowupOrcamentos(ctx.clinicId);
  },
});
