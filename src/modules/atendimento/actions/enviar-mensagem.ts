import { z } from 'zod';
import { createHash } from 'crypto';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { sendByChannel } from '../services/send-message-service';
import { sendWhatsApp as channelSendWhatsApp } from '../services/channel-service';
import { buildOutboundIdempotencyKey } from '@/lib/http/outbound-idempotency';
import * as repo from '../repositories/conversations-repository';

/**
 * Fingerprint determinístico do payload normalizado (canal|destino|texto).
 * Âncora pré-envio da chave de idempotência quando o caller não informa
 * `idempotencyKey` próprio. Normalização: trim do texto (colapso além disso
 * geraria falsos-positivos entre mensagens distintas).
 */
export function buildOutboundPayloadFingerprint(channel: string, to: string, text: string): string {
  return createHash('sha256').update(`${channel}|${to}|${text.trim()}`).digest('hex').slice(0, 16);
}

export const enviarMensagem = defineAction({
  name: 'atendimento.enviarMensagem',
  module: 'atendimento',
  requires: 'atendimento:manage_messages',
  label: 'Enviar mensagem',
  input: z.object({
    conversationId: z.string().uuid(),
    message: z.string().min(1),
    channel: z.enum(['whatsapp', 'instagram', 'web']).optional(),
    /**
     * Chave de idempotência da operação lógica (A3). Quando informada, o envio
     * usa claim local: a duplicata não reenvia ao provider. Sem ela, ancora-se
     * no fingerprint determinístico (conversa + payload) — ver limitações
     * documentadas no handler.
     */
    idempotencyKey: z.string().min(1).max(128).optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    // Resolve channel and verify ownership via tenant-scoped lookup
    const convScoped = await repo.findByIdForClinic(input.conversationId, ctx.clinicId);
    if (!convScoped) throw new ActionError('not_found', 'Conversa não encontrada.');

    let channel = input.channel;
    if (!channel) {
      const convWithJoins = await repo.findByIdWithJoins(input.conversationId, ctx.clinicId);
      if (!convWithJoins) throw new ActionError('not_found', 'Conversa não encontrada.');
      channel = convWithJoins.channel as 'whatsapp' | 'instagram' | 'web';
    }

    // A3 — idempotência outbound SEM reordenar criação do registro.
    //
    // Decisão: NÃO criar o registro antes do envio, pelos motivos:
    // 1. `messages` não tem coluna de status de entrega; `delivered_at` nunca é
    //    preenchido para outbound hoje (sempre NULL) — um registro pré-envio
    //    seria indistinguível de um entregue, e falha de envio deixaria
    //    mensagem fantasma na timeline (mudança de comportamento do produto).
    // 2. O id do registro não deduparia retries da action: cada retry criaria um
    //    novo registro (novo id → nova chave) e reenviaria — o oposto do
    //    objetivo. O fingerprint determinístico produz a MESMA chave em retries
    //    (inclusive entre processos), sem exigir schema novo.
    // A chave ancora no par disponível pré-envio (conversa + fingerprint).
    //
    // Limitação (colisão teórica): mesma conversa + mesmo texto normalizado
    // dentro do TTL do claim (10min) reutiliza a chave — o reenvio intencional
    // de texto idêntico nesse intervalo é suprimido. Escape: informar
    // `idempotencyKey` próprio por operação lógica.
    const stableId = input.idempotencyKey
      ?? `${input.conversationId}:${buildOutboundPayloadFingerprint(channel, convScoped.externalId, input.message)}`;
    let sendResult;
    if (channel === 'whatsapp') {
      // Mesmo transporte do shim (channel-service + failover sidecar), com chave.
      sendResult = await channelSendWhatsApp(
        convScoped.externalId,
        input.message,
        buildOutboundIdempotencyKey('whatsapp', ctx.clinicId, stableId),
      );
    } else {
      // instagram (stub legado) e web: contratos do shim preservados.
      sendResult = await sendByChannel(channel, convScoped.externalId, input.message);
    }
    if (!sendResult.success) {
      throw new ActionError('internal', sendResult.error ?? 'Falha ao enviar mensagem.');
    }

    // Store the outbound message — tenant-scoped append
    const message = await repo.appendOutboundMessage(ctx.clinicId, {
      conversationId: input.conversationId,
      content: input.message,
    });
    await repo.updateConversation(ctx.clinicId, input.conversationId, {
      lastMessageAt: new Date(),
      messageCountIncrement: 1,
    });
    return { messageId: message.id, channelSendResult: sendResult };
  },
});
