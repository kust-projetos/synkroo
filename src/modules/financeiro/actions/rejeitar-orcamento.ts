import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { assertClinicScope } from '@/core/actions/tenant-scope';
import { rejectBudget } from '../services/budget-service';

export const rejeitarOrcamento = defineAction({
  name: 'financeiro.rejeitarOrcamento',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Rejeitar orçamento',
  input: z.object({
    clinicId: z.string().uuid(),
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    assertClinicScope(input.clinicId, ctx);
    return rejectBudget(input.id, input.clinicId);
  },
});
