import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const listarParcelas = defineAction({
  name: 'financeiro.listarParcelas',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Listar parcelas',
  input: z.object({
    clinicId: z.string().uuid(),
    budgetId: z.string().uuid(),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    // Installments use budget_installments table - will be implemented when
    // Task 5/6 adds the installment service.
    return { data: [] };
  },
});
