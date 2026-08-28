import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { sendByChannel } from '../services/send-message-service';
import * as repo from '../repositories/conversations-repository';

export const enviarMensagem = defineAction({
  name: 'atendimento.enviarMensagem',
  module: 'atendimento',
  requires: 'atendimento:manage_messages',
  label: 'Enviar mensagem',
  input: z.object({
    conversationId: z.string().uuid(),
    message: z.string().min(1),
    channel: z.enum(['whatsapp', 'instagram', 'web']).optional(),
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

    // Send via channel service using scoped conversation's externalId
    const sendResult = await sendByChannel(channel, convScoped.externalId, input.message);
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
