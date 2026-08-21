/**
 * Financeiro — Asaas payload mapper.
 *
 * Maps Asaas API request/response shapes to normalized finance DTOs.
 */

import type { CreateChargeResult, NormalizedGatewayEvent } from '../../contracts';
import { normalizeAsaasWebhookEvent } from './webhook';

type AsaasChargeResponse = {
  id?: unknown;
  invoiceUrl?: unknown;
  pixQrCode?: unknown;
  status?: unknown;
};

function mapStatus(status: unknown): CreateChargeResult['status'] {
  switch (status) {
    case 'RECEIVED':
    case 'CONFIRMED':
      return 'paid';
    case 'OVERDUE':
      return 'overdue';
    case 'REFUNDED':
    case 'DELETED':
      return 'cancelled';
    default:
      return 'pending';
  }
}

/**
 * Map Asaas create charge response to normalized result.
 */
export function mapAsaasCreateChargeResponse(response: AsaasChargeResponse): CreateChargeResult {
  if (!response || typeof response !== 'object' || typeof response.id !== 'string' || !response.id) {
    throw new Error('Invalid Asaas create charge response');
  }

  return {
    externalChargeId: response.id,
    paymentUrl: typeof response.invoiceUrl === 'string' ? response.invoiceUrl : null,
    pixQrCode: typeof response.pixQrCode === 'string' ? response.pixQrCode : null,
    status: mapStatus(response.status),
  };
}

/**
 * Map Asaas webhook event to normalized gateway event.
 */
export function mapAsaasWebhookEvent(payload: unknown): NormalizedGatewayEvent {
  return normalizeAsaasWebhookEvent(payload);
}
