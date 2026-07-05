import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const gerarCobranca = defineAction({
  name: 'financeiro.gerarCobranca',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Gerar cobrança',
  input: z.object({
    clinicId: z.string().uuid(),
    budgetId: z.string().uuid(),
    dueDate: z.string(),
    amount: z.number().positive(),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    throw new Error('Not yet implemented');
  },
});
