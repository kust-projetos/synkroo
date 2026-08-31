import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { cancelCharge } from '../services/charge-service';

export const cancelarCobranca = defineAction({
  name: 'financeiro.cancelarCobranca',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Cancelar cobrança',
  input: z.object({
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const result = await cancelCharge({
      clinicId: ctx.clinicId,
      chargeId: input.id,
    });

    return {
      cancelled: result.cancelled,
      charge: result.charge,
    };
  },
});
