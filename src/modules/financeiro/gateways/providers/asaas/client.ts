/**
 * Financeiro — Asaas gateway HTTP client.
 *
 * Real HTTP integration using fetch.
 * Resolves API key per-clinic from encrypted_config in the DB.
 * Endpoint: sandbox | production based on ASAAS_API_URL env var.
 */

import type {
  PaymentGateway,
  CreateChargeInput,
  CreateChargeResult,
  GetChargeInput,
  GetChargeResult,
  CancelChargeInput,
  CancelChargeResult,
  WebhookInput,
  NormalizedGatewayEvent,
} from '../../contracts';
import { registerGatewayProvider } from '../../registry';
import { decrypt } from '../../../lib/crypto';
import { listGateways, getPaymentGateway } from '../../../repositories/financeiro-repository';
import { normalizeAsaasWebhookEvent } from './webhook';

const ASAAS_API_BASE = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';

async function getApiKey(clinicId: string): Promise<string> {
  const gateways = await listGateways(clinicId);
  const gw = gateways.find(g => g.provider === 'asaas' && g.isEnabled);
  if (!gw) throw new Error('No enabled Asaas gateway for this clinic');

  const full = await getPaymentGateway(gw.id);
  if (!full?.encryptedConfig) throw new Error('Gateway has no encrypted_config');

  const enc = full.encryptedConfig as { iv: string; data: string; tag: string };
  if (!enc.iv || !enc.data || !enc.tag) throw new Error('Invalid encrypted config');
  return decrypt(enc);
}

function reqHeaders(apiKey: string): Record<string, string> {
  return { 'Content-Type': 'application/json', access_token: apiKey };
}

function mapStatus(s: string): 'pending' | 'paid' | 'cancelled' | 'overdue' {
  const m: Record<string, 'pending' | 'paid' | 'cancelled' | 'overdue'> = {
    PENDING: 'pending', RECEIVED: 'paid', CONFIRMED: 'paid',
    OVERDUE: 'overdue', REFUNDED: 'cancelled', DELETED: 'cancelled',
  };
  return m[s] ?? 'pending';
}

export const asaasClient: PaymentGateway = {
  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const apiKey = await getApiKey(input.clinicId);
    const body = {
      customer: input.customerName,
      billingType: 'PIX',
      value: input.amount,
      dueDate: input.dueDate,
      description: input.description ?? '',
      externalReference: input.clinicId,
    };
    const res = await fetch(`${ASAAS_API_BASE}/payments`, {
      method: 'POST',
      headers: reqHeaders(apiKey),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Asaas createCharge failed: ${res.status} ${err}`);
    }
    const data = await res.json();
    return {
      externalChargeId: data.id,
      paymentUrl: data.invoiceUrl ?? null,
      pixQrCode: data.pixQrCode ?? null,
      status: mapStatus(data.status),
    };
  },

  async getCharge(input: GetChargeInput): Promise<GetChargeResult> {
    const apiKey = await getApiKey(input.clinicId);
    const res = await fetch(`${ASAAS_API_BASE}/payments/${input.externalChargeId}`, {
      headers: reqHeaders(apiKey),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Asaas getCharge failed: ${res.status} ${err}`);
    }
    const data = await res.json();
    return {
      externalChargeId: data.id,
      paymentUrl: data.invoiceUrl ?? null,
      pixQrCode: data.pixQrCode ?? null,
      status: mapStatus(data.status),
    };
  },

  async cancelCharge(input: CancelChargeInput): Promise<CancelChargeResult> {
    const apiKey = await getApiKey(input.clinicId);
    const res = await fetch(`${ASAAS_API_BASE}/payments/${input.externalChargeId}/cancel`, {
      method: 'POST',
      headers: reqHeaders(apiKey),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Asaas cancelCharge failed: ${res.status} ${err}`);
    }
    const data = await res.json();
    return { cancelled: data.status === 'CANCELED' };
  },

  async handleWebhook(input: WebhookInput): Promise<NormalizedGatewayEvent> {
    const { body } = input;
    return normalizeAsaasWebhookEvent(body);
  },
};

registerGatewayProvider('asaas', asaasClient);
