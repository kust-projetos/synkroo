/**
 * installment-replacement-repository.ts — Atomic installment replacement.
 *
 * Replaces existing installments for a budget with new ones in a single
 * transaction. If the insert fails (e.g., PostgreSQL constraint), the
 * delete is rolled back and original installments are preserved.
 */

import { getDb } from '@/lib/db/client';
import { budgets, budgetInstallments } from '@/modules/financeiro/schema';
import { eq, and } from 'drizzle-orm';
import { ActionError } from '@/core/actions/types';
import type { InferSelectModel } from 'drizzle-orm';

export type BudgetInstallmentRow = InferSelectModel<typeof budgetInstallments>;

export interface InstallmentInsert {
  budgetId: string;
  amount: string;
  dueDate: string;
  status: string;
}

/**
 * Atomically delete existing installments for a budget and insert replacements.
 * Runs inside a single db.transaction so a failed insert rolls back the delete.
 * Tenant-scoped: validates (budgetId, clinicId) via SELECT FOR UPDATE before any mutation.
 * Returns the newly inserted rows or throws if budget not found in clinic.
 */
export async function replaceInstallmentsAtomic(
  clinicId: string,
  budgetId: string,
  newInstallments: InstallmentInsert[],
): Promise<BudgetInstallmentRow[]> {
  const db = getDb();

  return db.transaction(async (tx) => {
    // Tenant-scoped lock: select budget by (id, clinicId) FOR UPDATE before mutating.
    // The predicate must be in the query that protects the mutation — not an in-memory comparison.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lockedQuery: any = tx.select().from(budgets).where(and(eq(budgets.id, budgetId), eq(budgets.clinicId, clinicId))).limit(1);
    const [locked] = await lockedQuery.for('update');
    if (!locked) {
      throw new ActionError('not_found', 'Budget not found');
    }

    // Delete existing (scoped to budget — budget already validated for clinic)
    await tx.delete(budgetInstallments).where(eq(budgetInstallments.budgetId, budgetId));

    // Insert new (if empty, just clear)
    if (newInstallments.length === 0) return [];
    const rowsInserted = await tx
      .insert(budgetInstallments)
      .values(newInstallments)
      .returning();

    return rowsInserted;
  });
}
