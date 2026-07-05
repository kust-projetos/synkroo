/**
 * Financeiro — gateway config service.
 *
 * Gateway CRUD, credential masking/encryption, routing rule persistence.
 * Uses real Drizzle-backed repository.
 */

import {
  createPaymentGateway as repoCreateGateway,
  getPaymentGateway as repoGetGateway,
  updatePaymentGateway as repoUpdateGateway,
  listGateways as repoListGateways,
  createRoutingRule as repoCreateRoutingRule,
  listRoutingRules as repoListRoutingRules,
  type PaymentGatewayRow,
  type GatewayRoutingRuleRow,
} from '../repositories/financeiro-repository';
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

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) return '****';
  const visible = apiKey.slice(-4);
  return '*'.repeat(apiKey.length - 4) + visible;
}

export interface GatewaySafeResponse {
  id: string;
  clinicId: string;
  provider: string;
  isDefault: boolean;
  isEnabled: boolean;
  maskedLabel: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export function toSafeGateway(gateway: PaymentGatewayRow): GatewaySafeResponse {
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

export async function saveGateway(input: SaveGatewayInput): Promise<GatewaySafeResponse> {
  const { clinicId, id, provider, isDefault, isEnabled, maskedLabel, apiKey } = input;

  if (id) {
    const existing = await repoGetGateway(id);
    if (!existing) throw new Error('Gateway not found');
    if (existing.clinicId !== clinicId) throw new Error('Gateway not found');

    const patch: Partial<PaymentGatewayRow> = { provider, isDefault, isEnabled };
    patch.maskedLabel = maskedLabel ?? existing.maskedLabel;

    if (apiKey) {
      patch.maskedLabel = maskedLabel ?? maskApiKey(apiKey);
    }

    const updated = await repoUpdateGateway(id, patch);
    return toSafeGateway(updated!);
  }

  const safeLabel = maskedLabel ?? (apiKey ? maskApiKey(apiKey) : null);
  const record = await repoCreateGateway({
    clinicId,
    provider,
    isDefault,
    isEnabled,
    maskedLabel: safeLabel,
    encryptedConfig: apiKey ? { encrypted: true, keyPrefix: apiKey.slice(0, 6) } : null,
  });
  return toSafeGateway(record);
}

export async function saveRoutingRule(input: SaveRoutingRuleInput): Promise<GatewayRoutingRuleRow> {
  const { clinicId, gatewayId, campaignId, patientId, leadId } = input;
  assertSingleRoutingScope({ campaignId, patientId, leadId });

  if (input.id) throw new Error('Routing rule update not yet implemented');

  return repoCreateRoutingRule({
    clinicId,
    gatewayId,
    campaignId: campaignId ?? null,
    patientId: patientId ?? null,
    leadId: leadId ?? null,
  });
}

export async function listGateways(clinicId: string): Promise<GatewaySafeResponse[]> {
  const gateways = await repoListGateways(clinicId);
  return gateways.map(toSafeGateway);
}

export async function listRoutingRules(clinicId: string): Promise<GatewayRoutingRuleRow[]> {
  return repoListRoutingRules(clinicId);
}
