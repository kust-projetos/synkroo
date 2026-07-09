import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listInstallments, calculateRemainingBalance } from '../services/installment-service';

export const listarParcelas = defineAction({
  name: 'financeiro.listarParcelas',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Listar parcelas',
  input: z.object({
    clinicId: z.string().uuid(),
    budgetId: z.string().uuid(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const installments = await listInstallments(input.budgetId);
    const remainingBalance = await calculateRemainingBalance(input.budgetId);
    return { data: installments, remaining_balance: remainingBalance };
  },
});
