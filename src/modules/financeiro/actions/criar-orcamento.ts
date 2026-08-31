import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { createBudget } from '../services/budget-service';

const createBudgetItem = z.object({
  procedureName: z.string().min(1),
  procedureId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().positive(),
  discountPercent: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export const criarOrcamento = defineAction({
  name: 'financeiro.criarOrcamento',
  module: 'financeiro',
  requires: 'financeiro:create_budget',
  label: 'Criar orçamento',
  input: z.object({
    patientId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    campaignId: z.string().uuid().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    validUntil: z.string().optional(),
    items: z.array(createBudgetItem).min(1),
  }).refine(
    (data) => {
      const hasPatient = !!data.patientId;
      const hasLead = !!data.leadId;
      return (hasPatient && !hasLead) || (!hasPatient && hasLead);
    },
    { message: 'Exactly one of patientId or leadId is required' },
  ),
  handler: async (input, ctx: ActionContext) => {
    const budget = await createBudget({ ...input, clinicId: ctx.clinicId });
    return budget;
  },
});
