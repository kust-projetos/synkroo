import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const salvarParcelas = defineAction({
  name: 'financeiro.salvarParcelas',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Salvar parcelas',
  input: z.object({
    clinicId: z.string().uuid(),
    budgetId: z.string().uuid(),
    installments: z.array(z.object({
      amount: z.number().positive(),
      dueDate: z.string(),
    })).min(1),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    // Installment CRUD will be implemented alongside budget_installments repository
    return { saved: true };
  },
});
