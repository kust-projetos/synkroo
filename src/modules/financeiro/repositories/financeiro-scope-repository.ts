/**
 * financeiro-scope-repository.ts — Focused scope-safe mutations for installments.
 *
 * Every function enforces tenant + budget boundary:
 *  - getBudgetForClinic: budget lookup scoped by clinicId
 *  - updateInstallmentForBudget: installment update scoped by budgetId
 *  - deleteInstallmentForBudget: installment delete scoped by budgetId + returning
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { budgets, budgetInstallments } from '@/lib/db/schema';
import type { InferSelectModel } from 'drizzle-orm';

export type BudgetRow = InferSelectModel<typeof budgets>;
export type BudgetInstallmentRow = InferSelectModel<typeof budgetInstallments>;

/**
 * Look up a budget only if it belongs to the given clinic.
 */
export async function getBudgetForClinic(
  budgetId: string,
  clinicId: string,
): Promise<BudgetRow | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, budgetId), eq(budgets.clinicId, clinicId)))
    .limit(1);
  return row;
}

/**
 * Update an installment only if it belongs to the given budget.
 * Returns the updated row or undefined if no match.
 */
export async function updateInstallmentForBudget(
  installmentId: string,
  budgetId: string,
  patch: Partial<BudgetInstallmentRow>,
): Promise<BudgetInstallmentRow | undefined> {
  const db = getDb();
  const [row] = await db
    .update(budgetInstallments)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(budgetInstallments.id, installmentId), eq(budgetInstallments.budgetId, budgetId)))
    .returning();
  return row;
}

/**
 * Delete an installment only if it belongs to the given budget.
 * Returns the deleted row or undefined if no match.
 */
export async function deleteInstallmentForBudget(
  installmentId: string,
  budgetId: string,
): Promise<BudgetInstallmentRow | undefined> {
  const db = getDb();
  const [row] = await db
    .delete(budgetInstallments)
    .where(and(eq(budgetInstallments.id, installmentId), eq(budgetInstallments.budgetId, budgetId)))
    .returning();
  return row;
}
