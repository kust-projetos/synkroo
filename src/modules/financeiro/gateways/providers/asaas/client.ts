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
import { decryptGatewayCredentials } from '../../../lib/crypto';
import { listGateways, getPaymentGateway } from '../../../repositories/financeiro-repository';
import { normalizeAsaasWebhookEvent } from './webhook';
import { fetchWithRetry, DEFAULT_EXTERNAL_TIMEOUT_MS } from '@/lib/http/fetch-with-retry';

const ASAAS_API_BASE = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';

async function getApiKey(clinicId: string): Promise<string> {
  const gateways = await listGateways(clinicId);
  const gw = gateways.find(g => g.provider === 'asaas' && g.isEnabled);
  if (!gw) throw new Error('No enabled Asaas gateway for this clinic');

  const full = await getPaymentGateway(gw.id);
  if (!full?.encryptedConfig) throw new Error('Gateway has no encrypted_config');

  const enc = full.encryptedConfig as { iv: string; data: string; tag: string };
  if (!enc.iv || !enc.data || !enc.tag) throw new Error('Invalid encrypted config');
  return decryptGatewayCredentials(enc).apiKey;
}

function reqHeaders(apiKey: string, idempotencyKey?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    access_token: apiKey,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  };
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
    // A2: timeout explícito; PODE retryar — carrega `Idempotency-Key`
    // (idempotente no provider) quando a chave é informada.
    const res = await fetchWithRetry(`${ASAAS_API_BASE}/payments`, {
      method: 'POST',
      headers: reqHeaders(apiKey, input.idempotencyKey),
      body: JSON.stringify(body),
    }, { timeoutMs: DEFAULT_EXTERNAL_TIMEOUT_MS, idempotencyKey: input.idempotencyKey });
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
    // A2: consulta GET — timeout + retry (idempotente por construção).
    const res = await fetchWithRetry(`${ASAAS_API_BASE}/payments/${input.externalChargeId}`, {
      headers: reqHeaders(apiKey),
    }, { timeoutMs: DEFAULT_EXTERNAL_TIMEOUT_MS });
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
    // A2: timeout explícito; PODE retryar — cancel com `Idempotency-Key`.
    const res = await fetchWithRetry(`${ASAAS_API_BASE}/payments/${input.externalChargeId}/cancel`, {
      method: 'POST',
      headers: reqHeaders(apiKey, input.idempotencyKey),
    }, { timeoutMs: DEFAULT_EXTERNAL_TIMEOUT_MS, idempotencyKey: input.idempotencyKey });
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
