import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

export const verificarWebhook = defineAction({
  name: 'atendimento.verificarWebhook',
  module: 'atendimento',
  requires: 'atendimento:manage_webhooks',
  label: 'Verificar webhook (desafio Meta)',
  input: z.object({
    mode: z.string(),
    token: z.string(),
    challenge: z.string(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    if (input.mode === 'subscribe' && input.token === VERIFY_TOKEN) {
      return { verified: true, challenge: input.challenge };
    }
    return { verified: false };
  },
});
