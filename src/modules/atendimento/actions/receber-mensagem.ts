import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { persistInboundMessage } from '../repositories/conversations-repository';

export const receberMensagem = defineAction({
  name: 'atendimento.receberMensagem',
  module: 'atendimento',
  requires: 'atendimento:manage_webhooks',
  label: 'Receber mensagem inbound',
  input: z.object({
    externalConversationId: z.string().trim().min(1).max(255),
    externalProvider: z.string().trim().min(1).max(64),
    externalMessageId: z.string().trim().min(1).max(255),
    message: z.string().min(1).max(32_000),
    channel: z.enum(['whatsapp', 'instagram', 'web']),
    messageType: z.enum(['text', 'image', 'audio', 'document']).default('text'),
    metadata: z.record(z.unknown()).optional(),
  }).strict(),
  handler: async (input, ctx: ActionContext) => {
    return persistInboundMessage({
      clinicId: ctx.clinicId,
      externalConversationId: input.externalConversationId,
      externalProvider: input.externalProvider,
      externalMessageId: input.externalMessageId,
      content: input.message,
      channel: input.channel,
      messageType: input.messageType,
      metadata: input.metadata ?? {},
    });
  },
});
