/**
 * WhatsApp provider registry — atendimento module (vNext P3.1).
 *
 * Single lookup seam for outbound provider adapters. `channel-service` no
 * longer imports a concrete provider: it asks the registry for the adapter of
 * the detected provider, which keeps provider detection and fallback order in
 * the facade while the transport lives behind the adapter.
 *
 * P3.1 registers Evolution only; P3.2 also registers the dormant WahaAdapter —
 * adding a provider is a registration here, not a new import in the facade.
 * Registration never activates a provider: the facade still picks one.
 */

import { evolutionWhatsAppProviderAdapter } from './evolution-adapter';
import { wahaWhatsAppProviderAdapter } from './waha-adapter';
import type {
  WhatsAppProviderAdapter,
  WhatsAppProviderId,
  WhatsAppProviderSendResult,
} from './whatsapp-provider-adapter';

export type {
  WhatsAppProviderAdapter,
  WhatsAppProviderId,
  WhatsAppProviderSendResult,
} from './whatsapp-provider-adapter';

const registry = new Map<WhatsAppProviderId, WhatsAppProviderAdapter>();

/** Adapters shipped with the app. Lazily seeded so tests can reset/override. */
function defaultAdapters(): WhatsAppProviderAdapter[] {
  return [evolutionWhatsAppProviderAdapter, wahaWhatsAppProviderAdapter];
}

function ensureSeeded(): void {
  for (const adapter of defaultAdapters()) {
    if (!registry.has(adapter.id)) registry.set(adapter.id, adapter);
  }
}

/** Adapter registered for `id`, or `null` when the provider is not wired yet. */
export function getWhatsAppProviderAdapter(id: WhatsAppProviderId): WhatsAppProviderAdapter | null {
  ensureSeeded();
  if (!id) return null;
  return registry.get(id) ?? null;
}

/** Ids of every registered adapter (stable order: registration order). */
export function listWhatsAppProviderAdapterIds(): WhatsAppProviderId[] {
  ensureSeeded();
  return [...registry.keys()];
}

/** Registers (or replaces) the adapter of a provider. Id-less adapters are ignored. */
export function registerWhatsAppProviderAdapter(adapter: WhatsAppProviderAdapter): void {
  ensureSeeded();
  if (!adapter?.id) return;
  registry.set(adapter.id, adapter);
}

/** Drops every registration; defaults are re-seeded on next access. */
export function resetWhatsAppProviderRegistry(): void {
  registry.clear();
}
