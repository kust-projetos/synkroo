import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { replaceInstallments } from '../services/installment-service';

export const salvarParcelas = defineAction({
  name: 'financeiro.salvarParcelas',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Salvar parcelas',
  input: z.object({
    budgetId: z.string().uuid(),
    installments: z.array(z.object({
      amount: z.number().positive(),
      dueDate: z.string(),
    })).min(1),
  }),
  handler: async (input, ctx: ActionContext) => {
    const clinicId = ctx.clinicId;
    const saved = await replaceInstallments(clinicId, input.budgetId, input.installments);
    return { saved: true, count: saved.length };
  },
});
