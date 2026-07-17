/**
 * budget-scope-service.ts — Tenant-scoped budget operations for route handlers.
 *
 * Route-facing layer. Delegates to financeiro-scope-repository for
 * budget lookup and installment mutations scoped by budget + tenant.
 * Routes MUST NOT import repositories directly.
 */

import * as scopeRepo from '../repositories/financeiro-scope-repository';
import type { BudgetRow, BudgetInstallmentRow } from '../repositories/financeiro-scope-repository';

/**
 * Look up a budget only if it belongs to the given clinic.
 */
export async function getBudgetForClinic(
  budgetId: string,
  clinicId: string,
): Promise<BudgetRow | undefined> {
  return scopeRepo.getBudgetForClinic(budgetId, clinicId);
}

/**
 * Update an installment scoped by budget. Returns updated row or undefined.
 */
export async function updateInstallmentForBudget(
  installmentId: string,
  budgetId: string,
  patch: Partial<BudgetInstallmentRow>,
): Promise<BudgetInstallmentRow | undefined> {
  return scopeRepo.updateInstallmentForBudget(installmentId, budgetId, patch);
}

/**
 * Delete an installment scoped by budget. Returns deleted row or undefined.
 */
export async function deleteInstallmentForBudget(
  installmentId: string,
  budgetId: string,
): Promise<BudgetInstallmentRow | undefined> {
  return scopeRepo.deleteInstallmentForBudget(installmentId, budgetId);
}
