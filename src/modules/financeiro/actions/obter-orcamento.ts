import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { getBudgetForClinic } from '../services/budget-service';

export const obterOrcamento = defineAction({
  name: 'financeiro.obterOrcamento',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Obter orçamento',
  input: z.object({
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const budget = await getBudgetForClinic(input.id, ctx.clinicId);
    if (!budget) {
      throw new ActionError('not_found', 'Orçamento não encontrado.');
    }
    return budget;
  },
});
