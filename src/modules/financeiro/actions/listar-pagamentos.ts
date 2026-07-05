import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listPayments } from '../services/payment-service';

export const listarPagamentos = defineAction({
  name: 'financeiro.listarPagamentos',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Listar pagamentos',
  input: z.object({
    clinicId: z.string().uuid(),
    budgetId: z.string().uuid(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const payments = await listPayments(input.budgetId);
    return { data: payments };
  },
});
