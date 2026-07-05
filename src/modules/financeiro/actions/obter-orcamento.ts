import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { getBudget } from '../services/budget-service';

export const obterOrcamento = defineAction({
  name: 'financeiro.obterOrcamento',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Obter orçamento',
  input: z.object({
    clinicId: z.string().uuid(),
    id: z.string().uuid(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const budget = await getBudget(input.id);
    if (!budget || budget.clinicId !== input.clinicId) {
      throw new Error('Budget not found');
    }
    return budget;
  },
});
