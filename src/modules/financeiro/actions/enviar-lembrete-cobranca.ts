import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const enviarLembreteCobranca = defineAction({
  name: 'financeiro.enviarLembreteCobranca',
  module: 'financeiro',
  requires: 'financeiro:manage_collections',
  label: 'Enviar lembrete de cobrança',
  input: z.object({
    clinicId: z.string().uuid(),
    chargeId: z.string().uuid(),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    // TODO: delegate WhatsApp send through Atendimento
    throw new Error('Not yet implemented');
  },
});
