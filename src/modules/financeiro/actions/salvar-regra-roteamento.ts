import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const salvarRegraRoteamento = defineAction({
  name: 'financeiro.salvarRegraRoteamento',
  module: 'financeiro',
  requires: 'financeiro:manage_gateways',
  label: 'Salvar regra de roteamento',
  input: z.object({
    clinicId: z.string().uuid(),
    id: z.string().uuid().optional(),
    gatewayId: z.string().uuid(),
    campaignId: z.string().uuid().optional(),
    patientId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
  }).refine(
    (data) => {
      const count = [data.campaignId, data.patientId, data.leadId].filter(Boolean).length;
      return count === 1;
    },
    { message: 'Exactly one scope target is required: campaignId, patientId, or leadId' },
  ),
  handler: async (_input, _ctx: ActionContext) => {
    // TODO: persist rule, scope enforcement via assertSingleRoutingScope
    throw new Error('Not yet implemented');
  },
});
