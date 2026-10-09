import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { sendByChannel } from '../services/send-message-service';

const CHANNELS = ['whatsapp', 'instagram', 'web'] as const;

export const enviarMensagemDireta = defineAction({
  name: 'atendimento.enviarMensagemDireta',
  module: 'atendimento',
  requires: 'atendimento:manage_messages',
  label: 'Enviar mensagem direta',
  // Envio externo: DENY hard para principal não-humano (runAction). E3: DENY
  // absoluto — token de aprovação NUNCA eleva (decisão humana vinculante).
  riskClass: 'deny_non_human',
  // Efeito consequencial: a tentativa é auditada ANTES do envio e finalizada
  // depois (falha da escrita inicial impede o envio; falha da finalização
  // devolve `unknown_effect` com a referência da tentativa, sem retry).
  consequential: true,
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
      // E3/E4 — o transporte (channel-service) classifica o efeito. Quando o
      // dispatch ocorreu mas a entrega NÃO foi confirmada (timeout/exceção após
      // possível envio) ele devolve `delivery: 'unknown'`: NÃO é falha conhecida
      // e NUNCA é sucesso — mapeia para `unknown_effect` (reconciliação manual,
      // sem retry automático; reenviar poderia duplicar). Demais falhas
      // determinísticas seguem `internal`. A mensagem é fixa e segura — detalhe
      // do provider fica só no log do servidor.
      if (result.delivery === 'unknown') {
        throw new ActionError('unknown_effect', 'Resultado do envio não confirmado.');
      }
      throw new ActionError('internal', 'Falha ao enviar mensagem.');
    }
    return { success: true, messageId: result.messageId };
  },
});
