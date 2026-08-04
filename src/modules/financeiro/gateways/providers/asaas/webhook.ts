/**
 * Financeiro — Asaas webhook handler.
 *
 * Validates, normalizes, and idempotently processes incoming Asaas webhook events.
 * Uses real Drizzle-backed repository for event log and settlement.
 */

import {
  findGatewayEvent as repoFindEvent,
  processGatewayEventAtomically,
  listGateways as repoListGateways,
} from '../../../repositories/financeiro-repository';
import type { NormalizedGatewayEvent, GatewayProvider, WebhookInput } from '../../contracts';

export function validateAsaasWebhookPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (!payload.event || typeof payload.event !== 'string') return false;
  if (!payload.payment || typeof payload.payment !== 'object') return false;
  return true;
}

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

const SETTLEMENT_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);

export function normalizeAsaasWebhookEvent(payload: any): NormalizedGatewayEvent {
  if (!validateAsaasWebhookPayload(payload)) throw new Error('Invalid Asaas webhook payload');

  const eventType = payload.event as string;
  const payment = payload.payment;

  const statusMap: Record<string, 'pending' | 'paid' | 'cancelled' | 'overdue'> = {
    PENDING: 'pending', RECEIVED: 'paid', CONFIRMED: 'paid', OVERDUE: 'overdue',
    REFUNDED: 'cancelled', REFUND_IN_PROGRESS: 'pending', CHARGEBACK_REQUESTED: 'pending',
    CHARGEBACK_DISPUTE: 'pending', AWAITING_CHARGEBACK_REVERSAL: 'pending',
    DUNNING_RECEIVED: 'paid', DUNNING_REQUESTED: 'pending', BANK_SLIPPED_VIEWED: 'pending', DELETED: 'cancelled',
  };

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

export async function processAsaasWebhook(input: WebhookInput): Promise<{ settled: boolean; duplicate?: boolean; chargeFound?: boolean }> {
  const { clinicId, body } = input;
  const payload = body as Record<string, unknown>;
  const normalized = normalizeAsaasWebhookEvent(payload);

  const existing = await repoFindEvent(normalized.provider, normalized.externalEventId);
  if (existing) return { settled: false, duplicate: true, chargeFound: true };

  const gateways = await repoListGateways(clinicId);
  const gateway = gateways.find(g => g.provider === normalized.provider);

  if (!gateway) {
    // No matching gateway → não podemos processar
    return { settled: false };
  }

  // Verifica se a cobrança (externalChargeId) existe localmente
  const paymentBody = payload.payment as Record<string, unknown> | undefined;
  const amount = paymentBody?.value ? String(paymentBody.value) : '0';
  return processGatewayEventAtomically({
    clinicId,
    gatewayId: gateway.id,
    provider: normalized.provider,
    externalEventId: normalized.externalEventId,
    externalChargeId: normalized.externalChargeId,
    payload,
    settlement: SETTLEMENT_EVENTS.has(payload.event as string),
    amount,
    paidAt: normalized.paidAt ?? new Date().toISOString(),
  });
}
