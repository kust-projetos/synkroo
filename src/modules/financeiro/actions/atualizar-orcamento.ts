import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { getBudgetForClinic } from '../services/budget-service';
import { centsToDecimal, percentOfCents, toCents } from '../services/money';
import { updateBudget } from '../repositories/financeiro-repository';
import type { BudgetRow } from '../repositories/financeiro-repository';

export const atualizarOrcamento = defineAction({
  name: 'financeiro.atualizarOrcamento',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Atualizar orçamento',
  // Etapa 5.3: audit money/schedule mutations (ADR-BASE-12 allowlist).
  auditFields: ['id', 'status', 'discountPercent', 'validUntil'],
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
      // Etapa 5.1: exact cents — no float drift on tv * pct.
      const tvCents = toCents(String(existing.totalValue));
      const dvCents = percentOfCents(tvCents, input.discountPercent);
      patch.discountValue = centsToDecimal(dvCents);
      patch.finalValue = centsToDecimal(tvCents - dvCents);
    }

    const updated = await updateBudget(input.id, patch);
    if (!updated) throw new ActionError('not_found', 'Orçamento não encontrado.');
    return updated;
  },
});
