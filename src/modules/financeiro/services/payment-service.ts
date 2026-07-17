/**
 * Financeiro — payment service.
 *
 * Business logic for manual payment registration.
 * Uses real Drizzle-backed repository.
 */

import {
  createPayment as repoCreatePayment,
  listPaymentsByBudget as repoListPayments,
  getPaymentCharge,
  updatePaymentCharge,
  type PaymentRow,
} from '../repositories/financeiro-repository';

export interface RegisterManualPaymentInput {
  clinicId: string;
  budgetId: string;
  chargeId?: string;
  amount: number;
  paymentMethod: string;
  paidAt?: string;
  notes?: string;
}

export async function registerManualPayment(input: RegisterManualPaymentInput): Promise<PaymentRow> {
  const { clinicId, budgetId, chargeId, amount, paymentMethod, notes } = input;
  const paidAt = input.paidAt ?? new Date().toISOString();

  if (chargeId) {
    const charge = await getPaymentCharge(chargeId);
    if (charge && charge.clinicId === clinicId && charge.status === 'pending') {
      await updatePaymentCharge(chargeId, { status: 'paid', paidAt: new Date(paidAt) });
    }
  }

  return repoCreatePayment({
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

export async function listPayments(budgetId: string): Promise<PaymentRow[]> {
  return repoListPayments(budgetId);
}
