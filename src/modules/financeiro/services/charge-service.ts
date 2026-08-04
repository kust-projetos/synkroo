/**
 * Financeiro — charge service.
 *
 * Gateway charge creation, cancellation, and webhook reconciliation.
 * Uses real Drizzle-backed repository.
 */

import { getGatewayProvider } from '../gateways/registry';
import {
  createPaymentCharge as repoCreateCharge,
  getPaymentCharge as repoGetCharge,
  updatePaymentCharge as repoUpdateCharge,
  listOverdueCharges as repoListOverdue,
  getDefaultGateway,
  getBudget,
  getPaymentGateway,
  createPayment as repoCreatePayment,
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
    const gatewayResponse = await provider.createCharge({ clinicId, amount, dueDate, customerName: 'Cliente' });
    const charge = await repoCreateCharge({
      clinicId: chargeData.clinicId,
      budgetId: chargeData.budgetId,
      gatewayId: chargeData.gatewayId,
      externalChargeId: gatewayResponse.externalChargeId,
      paymentUrl: gatewayResponse.paymentUrl,
      pixQrCode: gatewayResponse.pixQrCode,
      dueDate: chargeData.dueDate,
      amount: chargeData.amount,
      status: gatewayResponse.status,
    });
    return { charge, gatewayResponse };
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
      const gateway = await getPaymentGateway(charge.gatewayId);
      if (gateway?.isEnabled) {
        const provider = getGatewayProvider(gateway.provider as GatewayProvider);
        if (provider && charge.externalChargeId) {
          await provider.cancelCharge({ externalChargeId: charge.externalChargeId, clinicId });
        }
      }

      const updated = await repoUpdateCharge(chargeId, { status: 'cancelled' });
      return { cancelled: true, charge: updated! };
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
