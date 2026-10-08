import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { sendByChannel } from '../services/send-message-service';

const CHANNELS = ['whatsapp', 'instagram', 'web'] as const;

export const enviarMensagemDireta = defineAction({
  name: 'atendimento.enviarMensagemDireta',
  module: 'atendimento',
  requires: 'atendimento:manage_messages',
  label: 'Enviar mensagem direta',
  // Envio externo: DENY hard para principal não-humano (runAction).
  riskClass: 'deny_non_human',
  // Auditoria só com allowlist sem PII (externalId/message fora).
  auditFields: ['channel'] as const,
  input: z.object({
    channel: z.enum(CHANNELS),
    externalId: z.string().min(1),
    message: z.string().min(1),
  }),
  handler: async (input, _ctx: ActionContext) => {
    if (!CHANNELS.includes(input.channel)) {
      throw new Error(`Unsupported channel: ${input.channel}`);
    }
    const result = await sendByChannel(input.channel, input.externalId, input.message);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, messageId: result.messageId };
  },
});
