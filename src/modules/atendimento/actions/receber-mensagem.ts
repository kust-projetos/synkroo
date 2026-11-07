import { z } from 'zod/v3';
import { defineAction } from '@/core/actions';
import { ActionError, type ActionContext } from '@/core/actions/types';
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
    messageKind: z.enum(['text', 'button']).default('text'),
    /**
     * Provider message clock as ISO-8601 (converted + validated at the
     * webhook edge from the signed provider timestamp). Persisted into
     * `messages.metadata.authenticatedEventAt` — never derived from
     * `messages.createdAt` (insert time). Absent/invalid → persist anyway,
     * but confirmation/waitlist paths escalate instead of mutating.
     */
    eventTimestamp: z.string().datetime({ offset: true }).optional(),
    metadata: z.record(z.unknown()).optional(),
  }).strict(),
  handler: async (input, ctx: ActionContext) => {
    try {
      return await persistInboundMessage({
        clinicId: ctx.clinicId,
        externalConversationId: input.externalConversationId,
        externalProvider: input.externalProvider,
        externalMessageId: input.externalMessageId,
        content: input.message,
        channel: input.channel,
        messageType: input.messageType,
        messageKind: input.messageKind,
        eventTimestamp: input.eventTimestamp,
        metadata: input.metadata ?? {},
      });
    } catch {
      // A repository failure can embed the sender, the message body or a
      // connection string. Rethrowing it would put all of that into the central
      // action log (which logs unknown throws verbatim), so the failure is
      // replaced by a fixed generic error — deliberately WITHOUT `cause`, so
      // the original is unreachable from here. The caller still sees
      // `internal` and can decide to retry.
      throw new ActionError('internal', 'Falha ao persistir mensagem inbound.');
    }
  },
});
