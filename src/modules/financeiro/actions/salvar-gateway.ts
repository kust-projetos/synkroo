import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

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
  }),
  handler: async (_input, _ctx: ActionContext) => {
    // TODO: mask/encrypt secrets server-side; never return decrypted secret
    throw new Error('Not yet implemented');
  },
});
