import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const obterCobranca = defineAction({
  name: 'financeiro.obterCobranca',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Obter cobrança',
  input: z.object({
    clinicId: z.string().uuid(),
    id: z.string().uuid(),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    throw new Error('Not yet implemented');
  },
});
