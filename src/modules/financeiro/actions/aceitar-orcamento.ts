import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const aceitarOrcamento = defineAction({
  name: 'financeiro.aceitarOrcamento',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Aceitar orçamento',
  input: z.object({
    clinicId: z.string().uuid(),
    id: z.string().uuid(),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    // TODO: call comercial.converterLeadSemAgendar when budget has lead_id
    throw new Error('Not yet implemented');
  },
});
