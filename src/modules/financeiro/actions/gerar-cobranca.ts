import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { createCharge } from '../services/charge-service';

export const gerarCobranca = defineAction({
  name: 'financeiro.gerarCobranca',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Gerar cobrança',
  input: z.object({
    budgetId: z.string().uuid(),
    dueDate: z.string(),
    amount: z.number().positive(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const result = await createCharge({ ...input, clinicId: ctx.clinicId });
    return {
      charge: result.charge,
      paymentUrl: result.gatewayResponse.paymentUrl,
      pixQrCode: result.gatewayResponse.pixQrCode,
      status: result.gatewayResponse.status,
    };
  },
});
