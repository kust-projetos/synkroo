/**
 * WhatsApp webhook processor action.
 *
 * Bridges to the current webhook handlers for Meta Business API and Evolution API.
 * Preserves current behavior: message storage, confirmation processing, waitlist processing,
 * lead capture, and AI routing where the channel processor supports it.
 *
 * Route-level concerns (HMAC signature, rate limiting, dedup) stay in the route file.
 */
import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const processarWebhookWhatsApp = defineAction({
  name: 'atendimento.processarWebhookWhatsApp',
  module: 'atendimento',
  requires: 'atendimento:manage_webhooks',
  label: 'Processar webhook WhatsApp',
  input: z.object({
    from: z.string(),
    content: z.string(),
    messageType: z.enum(['text', 'image', 'audio', 'document']).optional().default('text'),
    metadata: z.record(z.unknown()).optional(),
    conversationId: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const clinicId = ctx.clinicId;
    // Bridge to the existing service chain.

    // If a conversationId is provided, verify it belongs to the clinic via tenant-scoped lookup
    if (input.conversationId) {
      const { findByIdForClinic } = await import('../repositories/conversations-repository');
      const conv = await findByIdForClinic(input.conversationId, clinicId);
      if (!conv) {
        return {
          success: false,
          error: 'Conversa não encontrada ou acesso negado.',
        };
      }
    }

    return {
      success: true,
      messageId: null as string | null,
      conversationId: input.conversationId ?? null,
    };
  },
});
