/**
 * Financeiro — charge service.
 *
 * Gateway charge creation, cancellation, and webhook reconciliation.
 * Uses real Drizzle-backed repository.
 */

import { getGatewayProvider } from '../gateways/registry';
import {
  createPaymentChargeWithOutbox as repoCreateChargeWithOutbox,
  getPaymentCharge as repoGetCharge,
  updatePaymentChargeWithOutbox as repoUpdateChargeWithOutbox,
  listOverdueCharges as repoListOverdue,
  getDefaultGateway,
  getBudget,
  type PaymentChargeRow,
} from '../repositories/financeiro-repository';
import { buildChargeInsert, findPaymentChargeByBudget } from '../repositories/financeiro-repository';
import { withIdempotency } from '@/lib/idempotency';
import type { CreateChargeResult, GatewayProvider } from '../gateways/contracts';

export interface CreateChargeInput {
  clinicId: string;
  budgetId: string;
  amount: number;
  dueDate: string;
}

/**
 * Create a payment charge, persisted via Drizzle.
 */
export async function createCharge(input: CreateChargeInput): Promise<{
  charge: PaymentChargeRow;
  gatewayResponse: CreateChargeResult;
}> {
  const { clinicId, budgetId, amount, dueDate } = input;

  const budget = await getBudget(budgetId);
  if (!budget || budget.clinicId !== clinicId) throw new Error('Budget not found');
  const expectedAmount = Number(budget.finalValue);
  if (!Number.isFinite(expectedAmount) || Math.abs(amount - expectedAmount) > 0.01) {
    throw new Error(`Charge amount ${amount} does not match budget final value ${budget.finalValue}`);
  }

  const gateway = await getDefaultGateway(clinicId);
  if (!gateway) throw new Error('No enabled default gateway found for clinic');

  const chargeData = buildChargeInsert({ clinicId, budgetId, gatewayId: gateway.id, amount, dueDate });
  const provider = getGatewayProvider(gateway.provider as GatewayProvider);
  if (!provider) throw new Error(`Gateway provider ${gateway.provider} is not registered`);
  const key = `charge:create:${clinicId}:${budgetId}`;
  const outcome = await withIdempotency(key, 'payment_charge_create', async () => {
    const charge = await repoCreateChargeWithOutbox({
      clinicId: chargeData.clinicId, budgetId: chargeData.budgetId, gatewayId: chargeData.gatewayId,
      dueDate: chargeData.dueDate, amount: chargeData.amount, businessKey: key,
      payload: { clinicId, budgetId, gatewayId: gateway.id, amount, dueDate, provider: gateway.provider },
    });
    return {
      charge,
      gatewayResponse: { externalChargeId: charge.externalChargeId ?? '', paymentUrl: charge.paymentUrl,
        pixQrCode: charge.pixQrCode, status: charge.status as CreateChargeResult['status'] },
    };
  });
  if (outcome.status === 'completed' && outcome.result) return outcome.result;
  const existing = await findPaymentChargeByBudget(clinicId, budgetId);
  if (existing) {
    return { charge: existing, gatewayResponse: {
      externalChargeId: existing.externalChargeId ?? '',
      paymentUrl: existing.paymentUrl,
      pixQrCode: existing.pixQrCode,
      status: existing.status as CreateChargeResult['status'],
    } };
  }
  throw new Error('Charge creation already in progress');
}

/**
 * Cancel a charge. Settled → no-op. Open → cancel via gateway + persist.
 */
export async function cancelCharge(input: {
  clinicId: string;
  chargeId: string;
}): Promise<{ cancelled: boolean; charge: PaymentChargeRow }> {
  const { clinicId, chargeId } = input;
  const charge = await repoGetCharge(chargeId);
  if (!charge) throw new Error('Charge not found');
  if (charge.clinicId !== clinicId) throw new Error('Charge not found');

  if (charge.status === 'paid' || charge.status === 'settled') {
    return { cancelled: false, charge };
  }

  const outcome = await withIdempotency(
    `charge:cancel:${clinicId}:${chargeId}`,
    'payment_charge_cancel',
    async () => {
      const updated = await repoUpdateChargeWithOutbox(chargeId, { status: 'cancellation_pending' }, {
        clinicId, businessKey: `charge:cancel:${clinicId}:${chargeId}`,
        payload: { clinicId, chargeId, gatewayId: charge.gatewayId, externalChargeId: charge.externalChargeId },
        expectedStatuses: ['pending', 'created', 'failed'],
      });
      if (!updated) {
        const current = await repoGetCharge(chargeId);
        if (current?.status === 'cancellation_pending' || current?.status === 'cancelled' || current?.status === 'paid' || current?.status === 'settled') {
          return { cancelled: false, charge: current };
        }
        throw new Error('Charge cancellation state changed concurrently');
      }
      return { cancelled: true, charge: updated };
    },
  );

  if (outcome.status === 'completed' && outcome.result) return outcome.result;
  if (outcome.status === 'already_processed') {
    const current = await repoGetCharge(chargeId);
    return { cancelled: false, charge: current ?? charge };
  }
  throw new Error('Charge cancellation already in progress');
}

export async function getCharge(id: string): Promise<PaymentChargeRow | undefined> {
  return repoGetCharge(id);
}

export async function listOverdueCharges(clinicId: string): Promise<PaymentChargeRow[]> {
  return repoListOverdue(clinicId);
}
