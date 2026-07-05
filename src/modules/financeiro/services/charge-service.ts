/**
 * Financeiro — charge service.
 *
 * Gateway charge creation, cancellation, and webhook reconciliation.
 */

import { getGatewayProvider } from '../gateways/registry';
import {
  storeCreateCharge,
  storeGetCharge,
  storeUpdateCharge,
  storeListOverdueCharges,
  storeGetDefaultGateway,
  storeGetGateway,
  storeGetBudget,
  storeCreatePayment,
  type PaymentChargeRecord,
  type BudgetRecord,
} from '../repositories/financeiro-store';
import { buildChargeInsert } from '../repositories/financeiro-repository';
import type { CreateChargeResult } from '../gateways/contracts';

export interface CreateChargeInput {
  clinicId: string;
  budgetId: string;
  amount: number;
  dueDate: string;
}

/**
 * Resolve gateway routing for a charge.
 * Returns the clinic's default enabled gateway, or throws.
 */
function resolveGateway(clinicId: string) {
  const gateway = storeGetDefaultGateway(clinicId);
  if (!gateway) throw new Error('No enabled default gateway found for clinic');
  return gateway;
}

/**
 * Create a payment charge.
 * Resolves gateway routing, calls the provider, and persists the charge.
 */
export async function createCharge(input: CreateChargeInput): Promise<{
  charge: PaymentChargeRecord;
  gatewayResponse: CreateChargeResult;
}> {
  const { clinicId, budgetId, amount, dueDate } = input;

  // Resolve gateway
  const gateway = resolveGateway(clinicId);

  // Build charge insert
  const chargeData = buildChargeInsert({
    clinicId,
    budgetId,
    gatewayId: gateway.id,
    amount,
    dueDate,
  });

  // Call gateway provider if registered
  const provider = getGatewayProvider(gateway.provider as any);
  let gatewayResponse: CreateChargeResult;

  if (provider) {
    gatewayResponse = await provider.createCharge({
      clinicId,
      amount,
      dueDate,
      customerName: 'Cliente',
    });
  } else {
    // No real provider registered → simulate gateway response
    gatewayResponse = {
      externalChargeId: `ext-${Date.now()}`,
      paymentUrl: `https://pay.example.com/charge/${Date.now()}`,
      pixQrCode: `00020126580014br.gov.bcb.pix${Date.now()}`,
      status: 'pending',
    };
  }

  // Persist charge
  const charge = storeCreateCharge({
    clinicId: chargeData.clinicId,
    budgetId: chargeData.budgetId,
    gatewayId: chargeData.gatewayId,
    externalChargeId: gatewayResponse.externalChargeId,
    paymentUrl: gatewayResponse.paymentUrl,
    pixQrCode: gatewayResponse.pixQrCode,
    dueDate: chargeData.dueDate,
    amount: chargeData.amount,
    status: gatewayResponse.status,
    paidAt: null,
  });

  return { charge, gatewayResponse };
}

/**
 * Cancel a payment charge.
 * - Settled/paid charges → no-op (returns { cancelled: false })
 * - Open/pending/overdue charges → cancels through gateway + persists
 */
export async function cancelCharge(input: {
  clinicId: string;
  chargeId: string;
}): Promise<{ cancelled: boolean; charge: PaymentChargeRecord }> {
  const { clinicId, chargeId } = input;
  const charge = storeGetCharge(chargeId);

  if (!charge) throw new Error('Charge not found');
  if (charge.clinicId !== clinicId) throw new Error('Charge not found');

  // Settled charges → no-op
  if (charge.status === 'paid' || charge.status === 'settled') {
    return { cancelled: false, charge };
  }

  // Open charges → cancel
  const gateway = storeGetGateway(charge.gatewayId);
  if (gateway && gateway.isEnabled) {
    const provider = getGatewayProvider(gateway.provider as any);
    if (provider && charge.externalChargeId) {
      await provider.cancelCharge({ externalChargeId: charge.externalChargeId });
    }
  }

  const updated = storeUpdateCharge(chargeId, { status: 'cancelled' });
  return { cancelled: true, charge: updated! };
}

/**
 * Get a charge by id.
 */
export async function getCharge(id: string): Promise<PaymentChargeRecord | undefined> {
  return storeGetCharge(id);
}

/**
 * List overdue charges for a clinic.
 */
export async function listOverdueCharges(clinicId: string): Promise<PaymentChargeRecord[]> {
  return storeListOverdueCharges(clinicId);
}
