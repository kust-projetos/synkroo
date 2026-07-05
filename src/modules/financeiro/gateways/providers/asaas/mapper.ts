/**
 * Financeiro — Asaas payload mapper.
 *
 * Maps Asaas API request/response shapes to normalized finance DTOs.
 * Full mapping implementation added alongside webhook processing.
 */

import type { CreateChargeResult, NormalizedGatewayEvent } from '../../contracts';

/**
 * Map Asaas create charge response to normalized result.
 */
export function mapAsaasCreateChargeResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any,
): CreateChargeResult {
  // TODO: implement mapping when Asaas API integration is built
  throw new Error('mapAsaasCreateChargeResponse not yet implemented');
}

/**
 * Map Asaas webhook event to normalized gateway event.
 */
export function mapAsaasWebhookEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
): NormalizedGatewayEvent {
  // TODO: implement webhook event mapping
  throw new Error('mapAsaasWebhookEvent not yet implemented');
}
