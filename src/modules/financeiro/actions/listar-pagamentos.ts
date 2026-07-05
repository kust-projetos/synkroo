import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const listarPagamentos = defineAction({
  name: 'financeiro.listarPagamentos',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Listar pagamentos',
  input: z.object({
    clinicId: z.string().uuid(),
    budgetId: z.string().uuid(),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    throw new Error('Not yet implemented');
  },
});
