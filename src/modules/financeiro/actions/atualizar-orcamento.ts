import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { getBudgetForClinic } from '../services/budget-service';
import { updateBudget } from '../repositories/financeiro-repository';
import type { BudgetRow } from '../repositories/financeiro-repository';

export const atualizarOrcamento = defineAction({
  name: 'financeiro.atualizarOrcamento',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Atualizar orçamento',
  input: z.object({
    id: z.string().uuid(),
    title: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    status: z.string().optional(),
    validUntil: z.string().optional().nullable(),
    discountPercent: z.number().min(0).max(100).optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const existing = await getBudgetForClinic(input.id, ctx.clinicId);
    if (!existing) throw new ActionError('not_found', 'Orçamento não encontrado.');

    const patch: Partial<BudgetRow> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.status !== undefined) patch.status = input.status;
    if (input.validUntil !== undefined) patch.validUntil = input.validUntil ? new Date(input.validUntil) as any : null;
    if (input.discountPercent !== undefined) {
      patch.discountPercent = String(input.discountPercent);
      const tv = Number(existing.totalValue);
      const dv = tv * (input.discountPercent / 100);
      patch.discountValue = String(dv);
      patch.finalValue = String(tv - dv);
    }

    const updated = await updateBudget(input.id, patch);
    if (!updated) throw new ActionError('not_found', 'Orçamento não encontrado.');
    return updated;
  },
});
