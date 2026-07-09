/**
 * Financeiro — installment service.
 *
 * Business logic for budget installments CRUD and remaining_balance calculation.
 * Uses real Drizzle-backed repository.
 */

import {
  createInstallments as repoCreate,
  listInstallments as repoList,
  deleteInstallmentsByBudget as repoDeleteByBudget,
  getInstallment as repoGet,
  updateInstallment as repoUpdate,
  deleteInstallment as repoDelete,
  listPaymentsByBudget as repoListPayments,
  getBudget as repoGetBudget,
  type BudgetInstallmentRow,
} from '../repositories/financeiro-repository';

export interface InstallmentInput {
  amount: number;
  dueDate: string;
}

/**
 * Replace installments for a budget: delete existing, insert new.
 * Enforces atomic replace: all or nothing via a single transaction.
 */
export async function replaceInstallments(
  budgetId: string,
  installments: InstallmentInput[],
): Promise<BudgetInstallmentRow[]> {
  if (installments.length === 0) return [];

  // Delete existing
  await repoDeleteByBudget(budgetId);

  // Insert new
  return repoCreate(
    installments.map(inst => ({
      budgetId,
      amount: String(inst.amount),
      dueDate: inst.dueDate,
      status: 'pending',
    })),
  );
}

/**
 * List installments for a budget.
 */
export async function listInstallments(budgetId: string): Promise<BudgetInstallmentRow[]> {
  return repoList(budgetId);
}

/**
 * Calculate the remaining balance for a budget.
 * Formula: finalValue - sum of settled payments.
 * Returns 0 if budget not found.
 */
export async function calculateRemainingBalance(budgetId: string): Promise<number> {
  const budget = await repoGetBudget(budgetId);
  if (!budget) return 0;

  const finalValue = parseFloat(budget.finalValue ?? '0');
  const payments = await repoListPayments(budgetId);
  const paidTotal = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  return Math.max(0, Math.round((finalValue - paidTotal) * 100) / 100);
}

/**
 * Get a single installment.
 */
export async function getInstallment(id: string): Promise<BudgetInstallmentRow | undefined> {
  return repoGet(id);
}

/**
 * Update a single installment.
 */
export async function updateInstallment(
  id: string,
  patch: Partial<Pick<BudgetInstallmentRow, 'amount' | 'dueDate' | 'status' | 'paidAt'>>,
): Promise<BudgetInstallmentRow | undefined> {
  return repoUpdate(id, patch as Partial<BudgetInstallmentRow>);
}

/**
 * Delete a single installment.
 */
export async function deleteInstallment(id: string): Promise<void> {
  await repoDelete(id);
}
