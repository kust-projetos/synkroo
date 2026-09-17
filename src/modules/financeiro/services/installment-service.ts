/**
 * Financeiro — installment service.
 *
 * Business logic for budget installments CRUD and remaining_balance calculation.
 * Uses real Drizzle-backed repository.
 */

import {
  getInstallment as repoGet,
  updateInstallment as repoUpdate,
  deleteInstallment as repoDelete,
  listInstallmentsForClinic as repoListForClinic,
  listPaymentsByBudgetForClinic as repoListPayments,
  getBudgetForClinic as repoGetBudgetForClinic,
  type BudgetInstallmentRow,
} from '../repositories/financeiro-repository';
import { getBudgetForClinic } from '../repositories/financeiro-scope-repository';
import { replaceInstallmentsAtomic } from '../repositories/installment-replacement-repository';
import { ActionError } from '@/core/actions/types';
import { centsToDecimal, splitCentsExact, toCents } from './money';

export interface InstallmentInput {
  amount: number;
  dueDate: string;
}

/**
 * Replace installments for a budget: delete existing, insert new.
 * Tenant-scoped: validates (budgetId, clinicId) via FOR UPDATE before mutation.
 * Uses atomic transaction so a failed insert rolls back the delete.
 */
export async function replaceInstallments(
  clinicId: string,
  budgetId: string,
  installments: InstallmentInput[],
): Promise<BudgetInstallmentRow[]> {
  if (installments.length === 0) {
    // Still need to validate tenant and clear installments atomically
    return replaceInstallmentsAtomic(
      clinicId,
      budgetId,
      [],
    );
  }

  return replaceInstallmentsAtomic(
    clinicId,
    budgetId,
    installments.map(inst => ({
      budgetId,
      // Etapa 5.2: canonicalize through cents — rejects >2-decimal artifacts
      // and persists a canonical 2-decimal string (e.g. '100.00').
      amount: centsToDecimal(toCents(inst.amount)),
      dueDate: inst.dueDate,
      status: 'pending',
    })),
  );
}

/**
 * List installments for a budget — tenant-scoped.
 * Returns empty if budget not in clinic (not_found semantics handled by caller).
 */
export async function listInstallments(clinicId: string, budgetId: string): Promise<BudgetInstallmentRow[]> {
  const budget = await getBudgetForClinic(budgetId, clinicId);
  if (!budget) {
    throw new ActionError('not_found', 'Budget not found');
  }
  return repoListForClinic(clinicId, budgetId);
}

/**
 * Split a total into `count` installments that sum EXACTLY to the total.
 * Remainder cents go to the FIRST installments (e.g. 100.00/3 →
 * [33.34, 33.33, 33.33]). Pure exact-decimal math, no float drift.
 */
export function splitTotalIntoInstallments(total: string | number, count: number): number[] {
  return splitCentsExact(toCents(total), count).map((c) => Number(c) / 100);
}

/**
 * Calculate the remaining balance for a budget — tenant-scoped.
 * Formula: finalValue - sum of settled payments, in integer cents.
 * Throws not_found if budget not in clinic.
 */
export async function calculateRemainingBalance(clinicId: string, budgetId: string): Promise<number> {
  const budget = await repoGetBudgetForClinic(budgetId, clinicId);
  if (!budget) {
    throw new ActionError('not_found', 'Budget not found');
  }

  const finalCents = toCents(budget.finalValue ?? '0');
  const payments = await repoListPayments(clinicId, budgetId);
  const paidCents = payments.reduce((sum, p) => sum + toCents(p.amount ?? '0'), 0n);

  const remaining = finalCents - paidCents;
  return Number(remaining > 0n ? remaining : 0n) / 100;
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
