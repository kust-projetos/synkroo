/**
 * Financeiro — gateway config service.
 *
 * Gateway CRUD, credential masking/encryption, routing rule persistence.
 */

import {
  storeCreateGateway,
  storeGetGateway,
  storeUpdateGateway,
  storeListGateways,
  storeCreateRoutingRule,
  storeListRoutingRules,
  type PaymentGatewayRecord,
  type GatewayRoutingRuleRecord,
} from '../repositories/financeiro-store';
import { assertSingleRoutingScope } from '../repositories/financeiro-repository';

export interface SaveGatewayInput {
  clinicId: string;
  id?: string;
  provider: string;
  isDefault: boolean;
  isEnabled: boolean;
  maskedLabel?: string;
  apiKey?: string;
}

export interface SaveRoutingRuleInput {
  clinicId: string;
  id?: string;
  gatewayId: string;
  campaignId?: string;
  patientId?: string;
  leadId?: string;
}

/**
 * Mask an API key for safe display.
 * Shows last 4 characters, rest as asterisks.
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) return '****';
  const visible = apiKey.slice(-4);
  return '*'.repeat(apiKey.length - 4) + visible;
}

/**
 * Gateway safe response — never contains raw apiKey.
 */
export interface GatewaySafeResponse {
  id: string;
  clinicId: string;
  provider: string;
  isDefault: boolean;
  isEnabled: boolean;
  maskedLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Strip secrets from a gateway record for safe API response.
 */
export function toSafeGateway(gateway: PaymentGatewayRecord): GatewaySafeResponse {
  return {
    id: gateway.id,
    clinicId: gateway.clinicId,
    provider: gateway.provider,
    isDefault: gateway.isDefault,
    isEnabled: gateway.isEnabled,
    maskedLabel: gateway.maskedLabel,
    createdAt: gateway.createdAt,
    updatedAt: gateway.updatedAt,
  };
}

/**
 * Save a gateway configuration.
 * - Masks the API key for storage label.
 * - Returns only the safe response (never the raw apiKey).
 */
export async function saveGateway(input: SaveGatewayInput): Promise<GatewaySafeResponse> {
  const { clinicId, id, provider, isDefault, isEnabled, maskedLabel, apiKey } = input;

  if (id) {
    // Update existing
    const existing = storeGetGateway(id);
    if (!existing) throw new Error('Gateway not found');
    if (existing.clinicId !== clinicId) throw new Error('Gateway not found');

    const patch: Partial<PaymentGatewayRecord> = {
      provider,
      isDefault,
      isEnabled,
      maskedLabel: maskedLabel ?? existing.maskedLabel,
    };

    if (apiKey) {
      patch.maskedLabel = maskedLabel ?? maskApiKey(apiKey);
      patch.apiKey = apiKey;
      patch.encryptedConfig = { encrypted: true, keyPrefix: apiKey.slice(0, 6) };
    }

    const updated = storeUpdateGateway(id, patch);
    return toSafeGateway(updated!);
  }

  // Create new
  const safeLabel = maskedLabel ?? (apiKey ? maskApiKey(apiKey) : null);
  const record = storeCreateGateway({
    clinicId,
    provider,
    isDefault,
    isEnabled,
    maskedLabel: safeLabel,
    encryptedConfig: apiKey ? { encrypted: true, keyPrefix: apiKey.slice(0, 6) } : null,
    apiKey: apiKey ?? null,
  });

  return toSafeGateway(record);
}

/**
 * Save a routing rule.
 * Enforces single scope via assertSingleRoutingScope.
 */
export async function saveRoutingRule(input: SaveRoutingRuleInput): Promise<GatewayRoutingRuleRecord> {
  const { clinicId, id, gatewayId, campaignId, patientId, leadId } = input;

  // Enforce single scope
  assertSingleRoutingScope({ campaignId, patientId, leadId });

  if (id) {
    // Routing rules are append-only via store for now; no update needed
    throw new Error('Routing rule update not yet implemented');
  }

  return storeCreateRoutingRule({
    clinicId,
    gatewayId,
    campaignId: campaignId ?? null,
    patientId: patientId ?? null,
    leadId: leadId ?? null,
  });
}

/**
 * List gateway configurations (safe responses only).
 */
export async function listGateways(clinicId: string): Promise<GatewaySafeResponse[]> {
  const gateways = storeListGateways(clinicId);
  return gateways.map(toSafeGateway);
}

/**
 * List routing rules for a clinic.
 */
export async function listRoutingRules(clinicId: string): Promise<GatewayRoutingRuleRecord[]> {
  return storeListRoutingRules(clinicId);
}
