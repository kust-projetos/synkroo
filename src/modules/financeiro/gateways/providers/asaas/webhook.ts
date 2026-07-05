/**
 * Financeiro — Asaas webhook handler.
 *
 * Validates, normalizes, and idempotently processes incoming Asaas webhook events.
 * - Upserts gateway_events before any settlement.
 * - Duplicate (provider, external_event_id) returns duplicate flag without settling again.
 * - Only PAYMENT_RECEIVED, PAYMENT_CONFIRMED events trigger settlement.
 */

import {
  storeFindGatewayEvent,
  storeCreateGatewayEvent,
  storeCreatePayment,
  storeListGateways,
} from '../../../repositories/financeiro-store';
import type { NormalizedGatewayEvent, GatewayProvider, WebhookInput } from '../../contracts';

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

// Events that indicate a payment has been settled and should trigger payment creation
const SETTLEMENT_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);

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

  // Set paidAt only for payment settlement events
  const isPaid = SETTLEMENT_EVENTS.has(eventType);

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
 * Process an Asaas webhook event with idempotent settlement.
 *
 * 1. Check if (provider, external_event_id) already processed → return duplicate.
 * 2. Log gateway event.
 * 3. If settlement event → create/update charge + create settled payment.
 * 4. Return result.
 */
export async function processAsaasWebhook(
  input: WebhookInput,
): Promise<{ settled: boolean; duplicate?: boolean }> {
  const { clinicId, body } = input;
  const payload = body as Record<string, unknown>;

  // Validate & normalize
  const normalized = normalizeAsaasWebhookEvent(payload);

  // Check idempotency: has this event already been processed?
  const existing = storeFindGatewayEvent(normalized.provider, normalized.externalEventId);
  if (existing) {
    return { settled: false, duplicate: true };
  }

  // Find the gateway for this clinic/provider
  const gateways = storeListGateways(clinicId);
  const gateway = gateways.find(g => g.provider === normalized.provider);

  // Log gateway event BEFORE settlement (prevents double-settle on crash)
  storeCreateGatewayEvent({
    clinicId,
    gatewayId: gateway?.id ?? null,
    chargeId: normalized.externalChargeId,
    provider: normalized.provider,
    externalEventId: normalized.externalEventId,
    payload: payload as Record<string, unknown>,
    processedAt: new Date().toISOString(),
  });

  // Only settlement events trigger payment/charge update
  const paymentBody = payload.payment as Record<string, unknown> | undefined;
  if (paymentBody && SETTLEMENT_EVENTS.has(payload.event as string)) {
    // Create a settled payment record for the received amount
    const amount = paymentBody.value ? String(paymentBody.value) : '0';
    storeCreatePayment({
      clinicId,
      budgetId: null,
      chargeId: normalized.externalChargeId,
      patientId: null,
      amount,
      paymentMethod: 'pix',
      status: 'settled',
      paidAt: normalized.paidAt ?? new Date().toISOString(),
      notes: `Asaas webhook: ${normalized.externalEventId}`,
      createdBy: null,
    });

    return { settled: true };
  }

  return { settled: false };
}
