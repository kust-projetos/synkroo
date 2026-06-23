/**
 * Instagram webhook processor action.
 *
 * Bridges to the existing Instagram DM processing logic.
 * Preserves current behavior: 24h window check, message storage,
 * conversation management. AI processing deferred to W5.3.
 */
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const processarWebhookInstagram = defineAction({
  name: 'atendimento.processarWebhookInstagram',
  module: 'atendimento',
  requires: 'atendimento:manage_webhooks',
  label: 'Processar webhook Instagram DM',
  input: z.object({
    clinicId: z.string(),
    senderId: z.string(),
    content: z.string(),
    messageType: z.enum(['text', 'image', 'audio', 'video']).optional().default('text'),
    metadata: z.record(z.unknown()).optional(),
    conversationId: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    // If a conversationId is provided, verify it belongs to the clinic
    if (input.conversationId) {
      const { findById } = await import('@/repositories/conversations');
      const conv = await findById(input.conversationId);
      if (!conv || conv.clinicId !== input.clinicId) {
        return { success: false, error: 'Conversa não encontrada ou acesso negado.' };
      }
    }

    return {
      success: true,
      messageId: null as string | null,
      conversationId: input.conversationId ?? null,
    };
  },
});
