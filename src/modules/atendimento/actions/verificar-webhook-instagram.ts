import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN;

export const verificarWebhookInstagram = defineAction({
  name: 'atendimento.verificarWebhookInstagram',
  module: 'atendimento',
  requires: 'atendimento:manage_webhooks',
  label: 'Verificar webhook Instagram (desafio Meta)',
  input: z.object({
    mode: z.string(),
    token: z.string(),
    challenge: z.string(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    if (input.mode === 'subscribe' && input.token && VERIFY_TOKEN && input.token === VERIFY_TOKEN) {
      return { verified: true, challenge: input.challenge };
    }
    return { verified: false };
  },
});
