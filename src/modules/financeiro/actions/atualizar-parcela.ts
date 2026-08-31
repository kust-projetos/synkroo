import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { getBudgetForClinic } from '../services/budget-service';
import { getInstallment, updateInstallment } from '../repositories/financeiro-repository';

export const atualizarParcela = defineAction({
  name: 'financeiro.atualizarParcela',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Atualizar parcela',
  input: z.object({
    budgetId: z.string().uuid(),
    installmentId: z.string().uuid(),
    amount: z.number().positive().optional(),
    dueDate: z.string().optional(),
    status: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const budget = await getBudgetForClinic(input.budgetId, ctx.clinicId);
    if (!budget) throw new ActionError('not_found', 'Orçamento não encontrado.');

    const existing = await getInstallment(input.installmentId);
    if (!existing || existing.budgetId !== input.budgetId) {
      throw new ActionError('not_found', 'Parcela não encontrada.');
    }

    const patch: any = {};
    if (input.amount !== undefined) patch.amount = String(input.amount);
    if (input.dueDate !== undefined) patch.dueDate = input.dueDate;
    if (input.status !== undefined) patch.status = input.status;

    const updated = await updateInstallment(input.installmentId, patch);
    if (!updated) throw new ActionError('not_found', 'Parcela não encontrada.');
    return updated;
  },
});
