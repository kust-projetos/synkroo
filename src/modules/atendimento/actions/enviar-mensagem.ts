import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { sendByChannel } from '../services/send-message-service';
import * as legacyRepo from '@/repositories/conversations';

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
    // Resolve channel from conversation if not provided
    let channel = input.channel;
    if (!channel) {
      const conv = await legacyRepo.findByIdWithJoins(input.conversationId, ctx.clinicId);
      if (!conv) throw new ActionError('not_found', 'Conversa não encontrada.');
      channel = conv.channel as 'whatsapp' | 'instagram' | 'web';
    }

    // Get the externalId (phone number for WhatsApp, IG ID for Instagram) from the conversation
    const conv = await legacyRepo.findById(input.conversationId);
    if (!conv) throw new ActionError('not_found', 'Conversa não encontrada.');
    if (conv.clinicId !== ctx.clinicId) throw new ActionError('forbidden', 'Acesso negado.');

    // Send via channel service
    const sendResult = await sendByChannel(channel, conv.externalId, input.message);
    if (!sendResult.success) {
      throw new ActionError('internal', sendResult.error ?? 'Falha ao enviar mensagem.');
    }

    // Store the outbound message
    const message = await legacyRepo.createMessage({
      conversationId: input.conversationId,
      direction: 'outbound',
      content: input.message,
    });
    await legacyRepo.updateConversation(input.conversationId, {
      lastMessageAt: new Date(),
      messageCountIncrement: 1,
    });
    return { messageId: message.id, channelSendResult: sendResult };
  },
});
