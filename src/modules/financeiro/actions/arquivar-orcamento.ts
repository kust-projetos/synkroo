import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { getBudgetForClinic } from '../services/budget-service';
import { updateBudget } from '../repositories/financeiro-repository';

export const arquivarOrcamento = defineAction({
  name: 'financeiro.arquivarOrcamento',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Arquivar orçamento',
  input: z.object({
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const existing = await getBudgetForClinic(input.id, ctx.clinicId);
    if (!existing) throw new ActionError('not_found', 'Orçamento não encontrado.');
    // Tombstone: archive via status, not physical delete (LGPD safe)
    const updated = await updateBudget(input.id, { status: 'archived' as any, updatedAt: new Date() as any });
    if (!updated) throw new ActionError('not_found', 'Orçamento não encontrado.');
    return { success: true, id: input.id };
  },
});
