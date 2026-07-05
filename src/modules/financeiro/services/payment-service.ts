/**
 * Financeiro — payment service.
 *
 * Business logic for manual payment registration, linking to installments, etc.
 */

export async function registerManualPayment(input: {
  clinicId: string;
  budgetId: string;
  amount: number;
  paymentMethod: string;
  paidAt?: string;
  notes?: string;
}) {
  // TODO: create settled payment + update linked installments
  throw new Error('Not yet implemented');
}
