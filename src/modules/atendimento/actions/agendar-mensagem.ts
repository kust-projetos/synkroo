import crypto from 'crypto';
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import * as repo from '../repositories/conversations-repository';

export const agendarMensagem = defineAction({
  name: 'atendimento.agendarMensagem',
  module: 'atendimento',
  requires: 'atendimento:manage_messages',
  label: 'Agendar mensagem',
  input: z.object({
    conversationId: z.string().uuid(),
    message: z.string().min(1),
    scheduledAt: z.coerce.date(),
    channel: z.enum(['whatsapp', 'instagram', 'web']).optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const conv = await repo.findByIdForClinic(input.conversationId, ctx.clinicId);
    if (!conv) throw new ActionError('not_found', 'Conversa não encontrada.');

    // Store the scheduled message metadata on the conversation for later pickup by a cron/queue.
    const metadata = {
      ...((conv.metadata ?? {}) as Record<string, unknown>),
      scheduledMessages: [
        ...(((conv.metadata as Record<string, unknown>)?.scheduledMessages as Array<Record<string, unknown>>) ?? []),
        {
          id: crypto.randomUUID(),
          content: input.message,
          scheduledAt: input.scheduledAt.toISOString(),
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    await repo.updateConversation(ctx.clinicId, input.conversationId, { metadata });

    return { success: true, scheduledAt: input.scheduledAt };
  },
});
