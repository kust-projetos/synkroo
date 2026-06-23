import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as repo from '../repositories/conversations-repository';

export const historicoMensagens = defineAction({
  name: 'atendimento.historicoMensagens',
  module: 'atendimento',
  requires: 'atendimento:view',
  label: 'Histórico de mensagens',
  input: z.object({
    conversationId: z.string().uuid(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const limit = input.limit ?? 50;
    const page = input.page ?? 1;
    const messages = await repo.findMessagesByConversation(input.conversationId, { limit, page });
    return { messages, pagination: { page, limit, total: messages.length, totalPages: 1 } };
  },
});
