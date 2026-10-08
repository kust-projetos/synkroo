/**
 * WhatsApp provider registry — atendimento module (vNext P3.1).
 *
 * Single lookup seam for outbound provider adapters. `channel-service` no
 * longer imports a concrete provider: it asks the registry for the adapter of
 * the detected provider, which keeps provider detection and fallback order in
 * the facade while the transport lives behind the adapter.
 *
 * WAHA-only (owner decision, commit 3863c4f): WAHA is the channel and is
 * registered FIRST — `DEFAULT_WHATSAPP_PROVIDER_ID` / `list…()[0]` point at
 * WAHA. Evolution stays registered as a DEPRECATED legacy fallback (outbound
 * adapter + active inbound route `/api/whatsapp/evolution` remain until the
 * owner retires them); it must not gain new behavior. Playwright sidecar and
 * business API are still NOT adapters here.
 *
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

/**
 * Default outbound provider — WAHA (owner decision, commit 3863c4f).
 * Evolution (`'evolution'`) remains registered as deprecated legacy only.
 */
export const DEFAULT_WHATSAPP_PROVIDER_ID: WhatsAppProviderId = 'waha';

/** Adapters shipped with the app. Lazily seeded so tests can reset/override. */
function defaultAdapters(): WhatsAppProviderAdapter[] {
  // WAHA-first: the default/deprecated order is the contract (see tests).
  return [wahaWhatsAppProviderAdapter, evolutionWhatsAppProviderAdapter];
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

/** Ids of every registered adapter (stable order: WAHA-first registration order). */
export function listWhatsAppProviderAdapterIds(): WhatsAppProviderId[] {
  ensureSeeded();
  return [...registry.keys()];
}

/** The default (WAHA) adapter, or `null` when it is not wired/overridden. */
export function getDefaultWhatsAppProviderAdapter(): WhatsAppProviderAdapter | null {
  return getWhatsAppProviderAdapter(DEFAULT_WHATSAPP_PROVIDER_ID);
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
