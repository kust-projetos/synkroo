import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { acceptBudget, getBudgetForClinic } from '../services/budget-service';
import { converterLeadSemAgendar } from '@/modules/comercial/public';

export const aceitarOrcamento = defineAction({
  name: 'financeiro.aceitarOrcamento',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Aceitar orçamento',
  input: z.object({
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const { clinicId } = ctx;
    const { id } = input;

    // Load budget to check lead context
    const budget = await getBudgetForClinic(id, clinicId);
    if (!budget) throw new Error('Budget not found');

    let patientId = budget.patientId;
    let convertedFromLeadId: string | null = null;

    // If budget has leadId (no patient yet), convert lead first
    if (budget.leadId && !budget.patientId) {
      const result = await converterLeadSemAgendar({
        leadId: budget.leadId,
        clinicId,
        actorUserId: ctx.user?.id ?? null,
      });

      patientId = result.patientId;
      convertedFromLeadId = budget.leadId;
    }

    // Accept budget with resolved patient info
    return acceptBudget(id, clinicId, {
      patientId: patientId ?? undefined,
      convertedFromLeadId: convertedFromLeadId ?? undefined,
    });
  },
});
