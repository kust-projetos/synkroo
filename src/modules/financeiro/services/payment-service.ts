/**
 * Financeiro — payment service.
 *
 * Business logic for manual payment registration.
 * Uses real Drizzle-backed repository.
 */

import {
  createPayment as repoCreatePayment,
  listPaymentsByBudgetForClinic as repoListPayments,
  getPaymentChargeForClinic,
  updatePaymentChargeForClinic,
  type PaymentRow,
} from '../repositories/financeiro-repository';
import { getBudgetForClinic } from '../repositories/financeiro-scope-repository';
import { getDb } from '@/lib/db/client';
import { payments, paymentCharges, budgets } from '@/modules/financeiro/schema';
import { eq, and } from 'drizzle-orm';
import { ActionError } from '@/core/actions/types';

export interface RegisterManualPaymentInput {
  clinicId: string;
  budgetId: string;
  chargeId?: string;
  amount: number;
  paymentMethod: string;
  paidAt?: string;
  notes?: string;
  actorUserId: string | null;
}

export async function registerManualPayment(input: RegisterManualPaymentInput): Promise<PaymentRow> {
  const { clinicId, budgetId, chargeId, amount, paymentMethod, notes, actorUserId } = input;
  const paidAt = input.paidAt ?? new Date().toISOString();
  const db = getDb();

  return db.transaction(async (tx) => {
    // Tenant-scoped lock: budget must belong to clinic; predicate is in the query that protects the mutation.
    // Try FOR UPDATE when Drizzle exposes it; fallback to plain select if not available.
    let budgetRow: any;
    try {
      const q: any = tx.select().from(budgets).where(and(eq(budgets.id, budgetId), eq(budgets.clinicId, clinicId))).limit(1);
      const rows = typeof q.for === 'function' ? await q.for('update') : await q;
      budgetRow = Array.isArray(rows) ? rows[0] : undefined;
    } catch {
      const [row] = await tx.select().from(budgets).where(and(eq(budgets.id, budgetId), eq(budgets.clinicId, clinicId))).limit(1);
      budgetRow = row;
    }
    if (!budgetRow) {
      throw new ActionError('not_found', 'Budget not found');
    }
    // If chargeId supplied, validate charge belongs to same clinic and budget
    if (chargeId) {
      const [charge] = await tx.select().from(paymentCharges).where(and(eq(paymentCharges.id, chargeId), eq(paymentCharges.clinicId, clinicId))).limit(1);
      if (!charge) {
        throw new ActionError('not_found', 'Charge not found');
      }
      if (charge.budgetId !== budgetId) {
        throw new ActionError('not_found', 'Charge does not belong to budget');
      }
      if (charge.status === 'pending') {
        await tx.update(paymentCharges).set({ status: 'paid', paidAt: new Date(paidAt), updatedAt: new Date() }).where(and(eq(paymentCharges.id, chargeId), eq(paymentCharges.clinicId, clinicId)));
      }
    }

    const [payment] = await tx.insert(payments).values({
      clinicId,
      budgetId,
      chargeId: chargeId ?? null,
      patientId: budgetRow.patientId ?? null,
      amount: String(amount),
      paymentMethod,
      status: 'settled',
      paidAt: new Date(paidAt),
      notes: notes ?? null,
      createdBy: actorUserId,
    }).returning();
    return payment as PaymentRow;
  });
}

export async function listPayments(clinicId: string, budgetId: string): Promise<PaymentRow[]> {
  const budget = await getBudgetForClinic(budgetId, clinicId);
  if (!budget) {
    throw new ActionError('not_found', 'Budget not found');
  }
  return repoListPayments(clinicId, budgetId);
}
