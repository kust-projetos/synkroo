import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as repo from '../repositories/conversations-repository';

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
    const conversationId = await repo.getOrCreateConversation(
      clinicId,
      input.channel,
      input.from,
    );
    const message = await repo.createMessage({
      conversationId,
      direction: 'inbound',
      content: input.message,
      metadata: input.metadata,
    });
    await repo.updateConversation(conversationId, {
      lastMessageAt: new Date(),
      messageCountIncrement: 1,
    });
    return { messageId: message.id, conversationId };
  },
});
