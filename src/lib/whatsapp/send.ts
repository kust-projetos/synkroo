/**
 * WhatsApp send helper — neutral lib layer.
 *
 * Provider-dispatching facade for sending WhatsApp messages.
 * Uses Evolution API (preferred) or Playwright fallback.
 *
 * Consumers: budgets/send, lead-notification, reminders-service
 * (cross-module via lib — satisfies boundaries/dependencies rule).
 */

import { getEvolutionService } from '@/modules/atendimento/services/evolution-service';
import { withOutboundIdempotency } from '@/lib/http/outbound-idempotency';

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** true quando a duplicata foi suprimida pelo claim de idempotência (A3). */
  deduplicated?: boolean;
}

function detectProvider(): 'evolution' | 'playwright' | 'business-api' {
  if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) return 'evolution';
  if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_TOKEN) return 'business-api';
  return 'playwright';
}

/**
 * Send a WhatsApp message using the configured provider.
 *
 * `idempotencyKey` (opcional, A3) ancora a operação lógica. Sem a chave, o
 * comportamento é o legado. Nenhum header de idempotência é enviado à
 * Evolution (sem suporte nativo documentado) — vale o claim local.
 */
export async function sendWhatsAppMessage(
  phone: string, message: string, idempotencyKey?: string,
): Promise<SendResult> {
  const provider = detectProvider();

  if (provider === 'evolution') {
    const evolutionService = getEvolutionService();
    if (evolutionService) {
      return idempotencyKey
        ? evolutionService.sendTextMessage(phone, message, { idempotencyKey })
        : evolutionService.sendTextMessage(phone, message);
    }
  }

  // Playwright fallback: delegate to channel-service sidecar client
  if (provider === 'playwright') {
    try {
      const { getWhatsAppService } = await import('@/modules/atendimento/services/channel-service');
      const service = getWhatsAppService();
      if (!idempotencyKey) return service.sendMessage(phone, message);
      const guarded = await withOutboundIdempotency(
        idempotencyKey,
        () => service.sendMessage(phone, message),
        { isSuccess: (r) => r.success },
      );
      if (guarded.deduped) return { success: true, deduplicated: true };
      return guarded.result ?? { success: false, error: 'Idempotency claim failed' };
    } catch {
      // Fallback service not available
    }
  }

  return { success: false, error: 'No WhatsApp provider available' };
}
