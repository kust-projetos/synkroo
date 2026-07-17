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

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function detectProvider(): 'evolution' | 'playwright' | 'business-api' {
  if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) return 'evolution';
  if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_TOKEN) return 'business-api';
  return 'playwright';
}

/** Send a WhatsApp message using the configured provider. */
export async function sendWhatsAppMessage(
  phone: string, message: string,
): Promise<SendResult> {
  const provider = detectProvider();

  if (provider === 'evolution') {
    const evolutionService = getEvolutionService();
    if (evolutionService) {
      return evolutionService.sendTextMessage(phone, message);
    }
  }

  // Playwright fallback: import lazily to avoid bundling in non-playwright paths
  if (provider === 'playwright') {
    try {
      const { getWhatsAppService } = await import('@/modules/atendimento/services/channel-service');
      const service = getWhatsAppService();
      if (service?.isConnected) {
        return service.sendMessage(phone, message);
      }
    } catch {
      // Playwright not available
    }
  }

  return { success: false, error: 'No WhatsApp provider available' };
}
