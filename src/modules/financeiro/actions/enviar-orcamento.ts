import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const enviarOrcamento = defineAction({
  name: 'financeiro.enviarOrcamento',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Enviar orçamento',
  input: z.object({
    clinicId: z.string().uuid(),
    id: z.string().uuid(),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    throw new Error('Not yet implemented');
  },
});
