/**
 * installment-replacement-repository.ts — Atomic installment replacement.
 *
 * Replaces existing installments for a budget with new ones in a single
 * transaction. If the insert fails (e.g., PostgreSQL constraint), the
 * delete is rolled back and original installments are preserved.
 */

import { getDb } from '@/lib/db/client';
import { budgetInstallments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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
 * Returns the newly inserted rows.
 */
export async function replaceInstallmentsAtomic(
  budgetId: string,
  newInstallments: InstallmentInsert[],
): Promise<BudgetInstallmentRow[]> {
  const db = getDb();

  return db.transaction(async (tx) => {
    // Delete existing
    await tx.delete(budgetInstallments).where(eq(budgetInstallments.budgetId, budgetId));

    // Insert new
    const rows = await tx
      .insert(budgetInstallments)
      .values(newInstallments)
      .returning();

    return rows;
  });
}
