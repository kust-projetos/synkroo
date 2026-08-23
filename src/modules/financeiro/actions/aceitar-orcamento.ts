import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { runAction } from '@/core/actions/run';
import { buildSystemContext } from '@/core/actions/context';
import { assertClinicScope } from '@/core/actions/tenant-scope';
import { acceptBudget, getBudget } from '../services/budget-service';
import { converterLeadSemAgendarAction } from '@/modules/comercial/actions';

export const aceitarOrcamento = defineAction({
  name: 'financeiro.aceitarOrcamento',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Aceitar orçamento',
  input: z.object({
    clinicId: z.string().uuid(),
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    assertClinicScope(input.clinicId, ctx);
    const { clinicId, id } = input;

    // Load budget to check lead context
    const budget = await getBudget(id);
    if (!budget) throw new Error('Budget not found');

    let patientId = budget.patientId;
    let convertedFromLeadId: string | null = null;

    // If budget has leadId (no patient yet), convert lead first
    if (budget.leadId && !budget.patientId) {
      const ctx = await buildSystemContext(clinicId);
      const result = await runAction(converterLeadSemAgendarAction, {
        leadId: budget.leadId,
        clinicId,
      }, ctx);

      if (!result.ok) {
        throw new Error(`Lead conversion failed: ${result.error.message}`);
      }

      patientId = (result.data as { patientId: string }).patientId;
      convertedFromLeadId = budget.leadId;
    }

    // Accept budget with resolved patient info
    return acceptBudget(id, clinicId, {
      patientId: patientId ?? undefined,
      convertedFromLeadId: convertedFromLeadId ?? undefined,
    });
  },
});
