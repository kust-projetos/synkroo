/**
 * Financeiro — charge service.
 *
 * Gateway charge creation, cancellation, webhook reconciliation.
 */

export async function createCharge(input: {
  clinicId: string;
  budgetId: string;
  amount: number;
  dueDate: string;
}) {
  // TODO: resolve gateway routing → call PaymentGateway.createCharge → persist payment_charges
  throw new Error('Not yet implemented');
}

export async function cancelCharge(input: {
  clinicId: string;
  chargeId: string;
}) {
  // TODO: only cancel if charge status is pending/overdue; settled is no-op
  throw new Error('Not yet implemented');
}
