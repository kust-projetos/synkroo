import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const obterOrcamento = defineAction({
  name: 'financeiro.obterOrcamento',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Obter orçamento',
  input: z.object({
    clinicId: z.string().uuid(),
    id: z.string().uuid(),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    throw new Error('Not yet implemented');
  },
});
