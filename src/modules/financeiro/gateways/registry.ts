/**
 * Financeiro — gateway provider registry.
 *
 * In-memory registry of PaymentGateway implementations per provider.
 * Providers register themselves at import time via registerGatewayProvider().
 */

import type { PaymentGateway, GatewayProvider } from './contracts';

const providers = new Map<GatewayProvider, PaymentGateway>();

/**
 * Register a gateway provider implementation.
 * Silently overwrites if the same provider is registered again.
 */
export function registerGatewayProvider(
  provider: GatewayProvider,
  implementation: PaymentGateway,
): void {
  providers.set(provider, implementation);
}

/**
 * Retrieve a registered gateway provider by name.
 * Returns undefined if the provider has not been registered.
 */
export function getGatewayProvider(
  provider: GatewayProvider,
): PaymentGateway | undefined {
  return providers.get(provider);
}

/**
 * List all registered provider names.
 */
export function listRegisteredProviders(): GatewayProvider[] {
  return Array.from(providers.keys());
}
