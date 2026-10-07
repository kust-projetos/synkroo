/**
 * EvolutionAdapter — atendimento module (vNext P3.1).
 *
 * Adapts the existing Evolution API leaf (`services/evolution-service`) to the
 * `WhatsAppProviderAdapter` contract. Deliberately thin: it resolves the leaf
 * lazily (env-driven configuration is read at call time, exactly as before),
 * forwards the send verbatim and lets provider failures surface to the caller.
 *
 * It does NOT own idempotency — `SendTextMessageInput['options'].idempotencyKey`
 * stays ignored at the leaf and the single claim lives in the facade
 * (`channel-service.runIdempotentSend`), which spans Evolution + fallback.
 */

import { getEvolutionService } from '../services/evolution-service';
import type {
  WhatsAppProviderAdapter,
  WhatsAppProviderSendResult,
} from './whatsapp-provider-adapter';

export class EvolutionAdapter implements WhatsAppProviderAdapter {
  readonly id = 'evolution' as const;

  isAvailable(): boolean {
    return getEvolutionService() !== null;
  }

  async sendTextMessage(to: string, text: string): Promise<WhatsAppProviderSendResult> {
    const service = getEvolutionService();
    // Fail-closed defensive path: the facade checks `isAvailable()` first, so
    // this only guards direct adapter callers. Never fabricates a messageId.
    if (!service) return { success: false, error: 'Evolution provider not available' };
    return service.sendTextMessage(to, text);
  }
}

export const evolutionWhatsAppProviderAdapter: WhatsAppProviderAdapter = new EvolutionAdapter();
