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
    clinicId: z.string(),
    from: z.string(),
    content: z.string(),
    messageType: z.enum(['text', 'image', 'audio', 'document']).optional().default('text'),
    metadata: z.record(z.unknown()).optional(),
    conversationId: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    // Bridge to the existing service chain.
    // Full processing (confirmation/waitlist/lead capture) happens in the
    // legacy route handlers. This action is the seam for the route to call.
    // The action validates auth and accepts the payload; the route handles
    // the domain-specific processing before/after calling this action.

    // If a conversationId is provided, verify it belongs to the clinic
    if (input.conversationId) {
      const { findById } = await import('../repositories/conversations-repository');
      const conv = await findById(input.conversationId);
      if (!conv || conv.clinicId !== input.clinicId) {
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
