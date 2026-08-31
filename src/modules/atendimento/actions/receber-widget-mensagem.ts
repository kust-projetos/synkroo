import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { persistInboundMessage } from '../repositories/conversations-repository';

export const receberWidgetMensagem = defineAction({
  name: 'atendimento.receberWidgetMensagem',
  module: 'atendimento',
  requires: 'atendimento:manage_webhooks',
  label: 'Receber mensagem do widget web',
  input: z.object({
    externalConversationId: z.string().trim().min(1).max(255),
    externalMessageId: z.string().trim().min(1).max(255),
    message: z.string().trim().min(1).max(32_000),
    metadata: z.record(z.unknown()).optional(),
  }).strict(),
  handler: async (input, ctx: ActionContext) => {
    return persistInboundMessage({
      clinicId: ctx.clinicId,
      channel: 'web',
      externalConversationId: input.externalConversationId,
      externalProvider: 'widget',
      externalMessageId: input.externalMessageId,
      content: input.message,
      messageType: 'text',
      metadata: input.metadata ?? {},
    });
  },
});
