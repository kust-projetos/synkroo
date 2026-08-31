import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { getChargeForClinic } from '../services/charge-service';

export const obterCobranca = defineAction({
  name: 'financeiro.obterCobranca',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Obter cobrança',
  input: z.object({
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const charge = await getChargeForClinic(input.id, ctx.clinicId);
    if (!charge) {
      throw new ActionError('not_found', 'Cobrança não encontrada.');
    }
    return charge;
  },
});
