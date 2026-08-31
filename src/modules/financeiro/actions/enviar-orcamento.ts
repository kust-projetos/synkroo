import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { markBudgetSent } from '../services/budget-service';

export const enviarOrcamento = defineAction({
  name: 'financeiro.enviarOrcamento',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Enviar orçamento',
  input: z.object({
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    return markBudgetSent(input.id, ctx.clinicId);
  },
});
