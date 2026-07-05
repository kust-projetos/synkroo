/**
 * Financeiro — Asaas webhook handler stub.
 *
 * Validates and normalizes incoming Asaas webhook events.
 * Full implementation in Task 6 (Asaas webhook + collections).
 */

import type { NormalizedGatewayEvent, GatewayProvider } from '../../contracts';

/**
 * Validate an Asaas webhook payload structure.
 * Returns true if the payload looks like a valid Asaas event.
 */
export function validateAsaasWebhookPayload(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (!payload.event || typeof payload.event !== 'string') return false;
  if (!payload.payment || typeof payload.payment !== 'object') return false;
  return true;
}

// Asaas event types we care about
export const ASAAS_WEBHOOK_EVENTS = {
  PAYMENT_CREATED: 'PAYMENT_CREATED',
  PAYMENT_UPDATED: 'PAYMENT_UPDATED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PAYMENT_OVERDUE: 'PAYMENT_OVERDUE',
  PAYMENT_DELETED: 'PAYMENT_DELETED',
  PAYMENT_RESTORED: 'PAYMENT_RESTORED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
  PAYMENT_RECEIVED_IN_CASH_UNDONE: 'PAYMENT_RECEIVED_IN_CASH_UNDONE',
  PAYMENT_CHARGEBACK_REQUESTED: 'PAYMENT_CHARGEBACK_REQUESTED',
  PAYMENT_CHARGEBACK_DISPUTE: 'PAYMENT_CHARGEBACK_DISPUTE',
  PAYMENT_AWAITING_CHARGEBACK_REVERSAL: 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
} as const;

/**
 * Normalize an Asaas webhook event to the standard gateway event format.
 */
export function normalizeAsaasWebhookEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
): NormalizedGatewayEvent {
  if (!validateAsaasWebhookPayload(payload)) {
    throw new Error('Invalid Asaas webhook payload');
  }

  const eventType = payload.event as string;
  const payment = payload.payment;

  // Asaas status → normalized status mapping
  const statusMap: Record<string, 'pending' | 'paid' | 'cancelled' | 'overdue'> = {
    PENDING: 'pending',
    RECEIVED: 'paid',
    CONFIRMED: 'paid',
    OVERDUE: 'overdue',
    REFUNDED: 'cancelled',
    REFUND_IN_PROGRESS: 'pending',
    CHARGEBACK_REQUESTED: 'pending',
    CHARGEBACK_DISPUTE: 'pending',
    AWAITING_CHARGEBACK_REVERSAL: 'pending',
    DUNNING_RECEIVED: 'paid',
    DUNNING_REQUESTED: 'pending',
    BANK_SLIPPED_VIEWED: 'pending',
    DELETED: 'cancelled',
  };

  // Set settledAt only for confirmed payment events
  const isPaid = payment.status === 'RECEIVED' || payment.status === 'CONFIRMED' || eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED';

  return {
    provider: 'asaas' as GatewayProvider,
    externalEventId: payload.id,
    externalChargeId: payment.id,
    status: statusMap[payment.status] ?? 'pending',
    paidAt: isPaid ? (payment.paymentDate ?? payment.confirmedDate ?? new Date().toISOString()) : undefined,
    raw: payload,
  };
}

/**
 * Process an Asaas webhook event with full reconciliation.
 * Stub — full implementation in Task 6.
 */
export async function processAsaasWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _input: any,
): Promise<{ settled: boolean; duplicate?: boolean }> {
  // TODO: implement webhook processing + idempotent settlement
  throw new Error('processAsaasWebhook not yet implemented');
}
