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
  handler: async (input, ctx: ActionContext) => {
    const limit = input.limit ?? 50;
    const page = input.page ?? 1;
    // Tenant-scoped: verify conversation belongs to clinic, then fetch messages via INNER JOIN
    const conversation = await repo.findByIdForClinic(input.conversationId, ctx.clinicId);
    if (!conversation) throw new (await import('@/core/actions/types')).ActionError('not_found', 'Conversa não encontrada.');
    const messages = await repo.findMessagesByConversation(ctx.clinicId, input.conversationId, { limit, page });
    return { messages, pagination: { page, limit, total: messages.length, totalPages: 1 } };
  },
});
