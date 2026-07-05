import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const registrarPagamento = defineAction({
  name: 'financeiro.registrarPagamento',
  module: 'financeiro',
  requires: 'financeiro:record_payment',
  label: 'Registrar pagamento',
  input: z.object({
    clinicId: z.string().uuid(),
    budgetId: z.string().uuid(),
    amount: z.number().positive(),
    paymentMethod: z.string().min(1),
    paidAt: z.string().optional(),
    notes: z.string().optional(),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    throw new Error('Not yet implemented');
  },
});
