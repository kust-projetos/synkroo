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
    budgetId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const clinicId = ctx.clinicId;
    const installments = await listInstallments(clinicId, input.budgetId);
    const remainingBalance = await calculateRemainingBalance(clinicId, input.budgetId);
    return { data: installments, remaining_balance: remainingBalance };
  },
});
