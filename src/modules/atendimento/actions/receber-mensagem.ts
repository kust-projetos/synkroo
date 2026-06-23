import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as repo from '../repositories/conversations-repository';
import * as legacyRepo from '@/repositories/conversations';

export const receberMensagem = defineAction({
  name: 'atendimento.receberMensagem',
  module: 'atendimento',
  requires: 'atendimento:manage_webhooks',
  label: 'Receber mensagem inbound',
  input: z.object({
    clinicId: z.string().optional(),
    from: z.string(),
    message: z.string(),
    channel: z.enum(['whatsapp', 'instagram', 'web', 'telegram']).optional().default('whatsapp'),
    metadata: z.record(z.unknown()).optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const clinicId = input.clinicId ?? ctx.clinicId;
    const conversationId = await legacyRepo.getOrCreateConversation(
      clinicId,
      input.channel,
      input.from,
    );
    const message = await legacyRepo.createMessage({
      conversationId,
      direction: 'inbound',
      content: input.message,
      metadata: input.metadata,
    });
    await legacyRepo.updateConversation(conversationId, {
      lastMessageAt: new Date(),
      messageCountIncrement: 1,
    });
    return { messageId: message.id, conversationId };
  },
});
