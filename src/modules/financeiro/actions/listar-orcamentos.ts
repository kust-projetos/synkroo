import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listBudgets } from '../services/budget-service';

export const listarOrcamentos = defineAction({
  name: 'financeiro.listarOrcamentos',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Listar orçamentos',
  input: z.object({
    clinicId: z.string().uuid(),
    status: z.string().optional(),
    patientId: z.string().uuid().optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const budgets = await listBudgets(input.clinicId, input.status);
    return { data: budgets, total: budgets.length };
  },
});
