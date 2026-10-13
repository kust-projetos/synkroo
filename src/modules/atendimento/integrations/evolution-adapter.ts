/**
 * EvolutionAdapter — atendimento module (vNext P3.1).
 *
 * @deprecated WAHA is the channel (owner decision, commit 3863c4f) and
 * Evolution will be discontinued. This adapter is kept as a deprecated legacy
 * fallback only: the facade (`services/channel-service`) prefers WAHA, the
 * provider registry lists WAHA first, and no new Evolution behavior may be
 * added here. The active inbound route `/api/whatsapp/evolution` (see
 * `src/app/api/whatsapp/evolution/route.ts`) is likewise legacy and is
 * outside the WAHA-only cutover scope — it stays until the owner retires it.
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

/** @deprecated Legacy provider — WAHA is the channel (owner decision, commit 3863c4f). */
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

/** @deprecated Legacy registration — prefer the WAHA adapter (owner decision, commit 3863c4f). */
export const evolutionWhatsAppProviderAdapter: WhatsAppProviderAdapter = new EvolutionAdapter();
