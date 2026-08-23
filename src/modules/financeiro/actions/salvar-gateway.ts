import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { assertClinicScope } from '@/core/actions/tenant-scope';
import { saveGateway } from '../services/gateway-config-service';

export const salvarGateway = defineAction({
  name: 'financeiro.salvarGateway',
  module: 'financeiro',
  requires: 'financeiro:manage_gateways',
  label: 'Salvar gateway',
  input: z.object({
    clinicId: z.string().uuid(),
    id: z.string().uuid().optional(),
    provider: z.enum(['asaas', 'mercado_pago', 'pagarme', 'efi']),
    isDefault: z.boolean().default(false),
    isEnabled: z.boolean().default(true),
    maskedLabel: z.string().optional(),
    apiKey: z.string().optional(),
    webhookToken: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    assertClinicScope(input.clinicId, ctx);
    const safe = await saveGateway(input);
    return safe; // safe response — no apiKey field
  },
});
