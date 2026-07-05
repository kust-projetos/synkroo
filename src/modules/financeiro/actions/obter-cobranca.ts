import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { getCharge } from '../services/charge-service';

export const obterCobranca = defineAction({
  name: 'financeiro.obterCobranca',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Obter cobrança',
  input: z.object({
    clinicId: z.string().uuid(),
    id: z.string().uuid(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const charge = await getCharge(input.id);
    if (!charge || charge.clinicId !== input.clinicId) {
      throw new Error('Charge not found');
    }
    return charge;
  },
});
