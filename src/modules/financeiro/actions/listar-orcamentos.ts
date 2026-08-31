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
    status: z.string().optional(),
    patientId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
  handler: async (input, ctx: ActionContext) => {
    // Fetch all for clinic, then apply patientId filter and pagination
    let budgets = await listBudgets(ctx.clinicId, input.status);
    if (input.patientId) {
      budgets = budgets.filter((b: any) => b.patientId === input.patientId);
    }
    const total = budgets.length;
    const start = (input.page - 1) * input.limit;
    const paged = budgets.slice(start, start + input.limit);
    return { data: paged, meta: { total } };
  },
});
