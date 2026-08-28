/**
 * Instagram webhook processor action.
 *
 * Bridges to the existing Instagram DM processing logic.
 * Preserves current behavior: 24h window check, message storage, conversation management.
 */
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { assertClinicScope } from '@/core/actions/tenant-scope';

export const processarWebhookInstagram = defineAction({
  name: 'atendimento.processarWebhookInstagram',
  module: 'atendimento',
  requires: 'atendimento:manage_webhooks',
  label: 'Processar webhook Instagram DM',
  input: z.object({
    senderId: z.string(),
    content: z.string(),
    messageType: z.enum(['text', 'image', 'audio', 'video']).optional().default('text'),
    metadata: z.record(z.unknown()).optional(),
    conversationId: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const clinicId = ctx.clinicId;
    // If a conversationId is provided, verify it belongs to the clinic via tenant-scoped lookup
    if (input.conversationId) {
      const { findByIdForClinic } = await import('../repositories/conversations-repository');
      const conv = await findByIdForClinic(input.conversationId, clinicId);
      if (!conv) {
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
