import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const cancelarCobranca = defineAction({
  name: 'financeiro.cancelarCobranca',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Cancelar cobrança',
  input: z.object({
    clinicId: z.string().uuid(),
    id: z.string().uuid(),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    // TODO: only cancels open charge; settled charge is no-op
    throw new Error('Not yet implemented');
  },
});
