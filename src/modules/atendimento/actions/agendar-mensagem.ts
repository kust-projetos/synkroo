import crypto from 'crypto';
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import * as legacyRepo from '@/repositories/conversations';

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
    const conv = await legacyRepo.findById(input.conversationId);
    if (!conv) throw new ActionError('not_found', 'Conversa não encontrada.');
    if (conv.clinicId !== ctx.clinicId) throw new ActionError('forbidden', 'Acesso negado.');

    // Store the scheduled message metadata on the conversation for later pickup by a cron/queue.
    // This is a minimal scheduling seam — a real queue runner will be added in W5.
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
    await legacyRepo.updateConversation(input.conversationId, { metadata });

    return { success: true, scheduledAt: input.scheduledAt };
  },
});
