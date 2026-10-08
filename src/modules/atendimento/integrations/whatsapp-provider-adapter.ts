/**
 * WhatsApp provider contract — atendimento module (vNext P3.1).
 *
 * Provider-neutral seam between the outbound facades (`services/channel-service`)
 * and the concrete WhatsApp providers. Callers keep using the facade /
 * Action interfaces; the facade keeps owning idempotency, provider detection
 * and the fallback order — the adapter is a LEAF: transport + mapping only,
 * never a dedup decision and never a provider-selection decision.
 *
 * P3.1 ships the contract + registry + the Evolution adapter; P3.2 adds the
 * dormant WahaAdapter (outbound text) behind the same contract. Registration
 * alone does not activate a provider: `channel-service` keeps choosing.
 */

/** Provider identifiers understood by the detection logic in the facade. */
export type WhatsAppProviderId = 'evolution' | 'waha' | 'playwright' | 'business-api';

/**
 * Result contract of an outbound provider call. Structurally compatible with
 * the facade's `SendResult` — `deduplicated` is produced only by the facade
 * (idempotency claim), never by an adapter.
 */
export interface WhatsAppProviderSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * A WhatsApp provider adapter.
 *
 * `isAvailable()` must be cheap, synchronous and side-effect free: the facade
 * calls it to decide whether the provider can be attempted at all (the leaf
 * may be unconfigured). `sendTextMessage()` resolves the provider on demand —
 * so an adapter never caches "configured" state across env changes.
 */
export interface WhatsAppProviderAdapter {
  /** Provider id under which the adapter is registered. */
  readonly id: WhatsAppProviderId;
  /** true when the underlying provider client can be resolved right now. */
  isAvailable(): boolean;
  /** Sends a text message. Provider failures propagate (results or throws). */
  sendTextMessage(to: string, text: string): Promise<WhatsAppProviderSendResult>;
}
