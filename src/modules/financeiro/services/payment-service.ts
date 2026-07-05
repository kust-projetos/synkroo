/**
 * Financeiro — payment service.
 *
 * Business logic for manual payment registration, linking to installments.
 */

import {
  storeCreatePayment,
  storeGetCharge,
  storeUpdateCharge,
  storeListPayments,
  type PaymentRecord,
} from '../repositories/financeiro-store';

export interface RegisterManualPaymentInput {
  clinicId: string;
  budgetId: string;
  chargeId?: string;
  amount: number;
  paymentMethod: string;
  paidAt?: string;
  notes?: string;
}

/**
 * Register a manual payment.
 * Creates a settled payment record. If linked to a charge, marks charge as paid.
 */
export async function registerManualPayment(input: RegisterManualPaymentInput): Promise<PaymentRecord> {
  const { clinicId, budgetId, chargeId, amount, paymentMethod, notes } = input;
  const paidAt = input.paidAt ?? new Date().toISOString();

  // If linked to a charge, mark it as paid
  if (chargeId) {
    const charge = storeGetCharge(chargeId);
    if (charge && charge.clinicId === clinicId && charge.status === 'pending') {
      storeUpdateCharge(chargeId, { status: 'paid', paidAt });
    }
  }

  return storeCreatePayment({
    clinicId,
    budgetId,
    chargeId: chargeId ?? null,
    patientId: null,
    amount: String(amount),
    paymentMethod,
    status: 'settled',
    paidAt,
    notes: notes ?? null,
    createdBy: null,
  });
}

/**
 * List payments for a budget.
 */
export async function listPayments(budgetId: string): Promise<PaymentRecord[]> {
  return storeListPayments(budgetId);
}
