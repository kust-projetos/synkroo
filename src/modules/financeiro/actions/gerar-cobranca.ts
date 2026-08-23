import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { assertClinicScope } from '@/core/actions/tenant-scope';
import { createCharge } from '../services/charge-service';

export const gerarCobranca = defineAction({
  name: 'financeiro.gerarCobranca',
  module: 'financeiro',
  requires: 'financeiro:manage_budget',
  label: 'Gerar cobrança',
  input: z.object({
    clinicId: z.string().uuid(),
    budgetId: z.string().uuid(),
    dueDate: z.string(),
    amount: z.number().positive(),
  }),
  handler: async (input, ctx: ActionContext) => {
    assertClinicScope(input.clinicId, ctx);
    const result = await createCharge(input);
    return {
      charge: result.charge,
      paymentUrl: result.gatewayResponse.paymentUrl,
      pixQrCode: result.gatewayResponse.pixQrCode,
      status: result.gatewayResponse.status,
    };
  },
});
