/**
 * Financeiro — budget service.
 *
 * Business logic for CRUD, totals, discounts, and status transitions on budgets.
 */

import {
  storeCreateBudget,
  storeGetBudget,
  storeUpdateBudget,
  storeListBudgets,
  type BudgetRecord,
} from '../repositories/financeiro-store';

export interface BudgetItemInput {
  procedureName: string;
  procedureId?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  notes?: string;
}

export interface CreateBudgetInput {
  clinicId: string;
  patientId?: string;
  leadId?: string;
  campaignId?: string;
  title?: string;
  description?: string;
  discountPercent?: number;
  validUntil?: string;
  items: BudgetItemInput[];
}

export interface BudgetTotals {
  totalValue: number;
  discountPercent: number;
  discountValue: number;
  finalValue: number;
}

/**
 * Calculate deterministic budget totals from items and optional discount.
 */
export function calculateBudgetTotals(items: BudgetItemInput[], discountPercent = 0): BudgetTotals {
  const totalValue = items.reduce((sum, item) => {
    return sum + item.quantity * item.unitPrice;
  }, 0);

  const discountValue = discountPercent > 0
    ? Math.round(totalValue * (discountPercent / 100) * 100) / 100
    : 0;

  const finalValue = Math.max(0, totalValue - discountValue);

  return {
    totalValue,
    discountPercent,
    discountValue,
    finalValue,
  };
}

/**
 * Calculate item total price with per-item discount.
 */
function calculateItemTotal(
  quantity: number,
  unitPrice: number,
  discountPercent?: number,
): number {
  const subtotal = quantity * unitPrice;
  if (!discountPercent || discountPercent <= 0) return subtotal;
  const discount = subtotal * (discountPercent / 100);
  return Math.round((subtotal - discount) * 100) / 100;
}

/**
 * Create a budget with deterministic totals.
 */
export async function createBudget(input: CreateBudgetInput): Promise<BudgetRecord> {
  const totals = calculateBudgetTotals(input.items, input.discountPercent);

  const items = input.items.map(item => ({
    id: '',
    budgetId: '',
    procedureName: item.procedureName,
    quantity: item.quantity,
    unitPrice: String(item.unitPrice),
    discountPercent: String(item.discountPercent ?? 0),
    totalPrice: String(calculateItemTotal(item.quantity, item.unitPrice, item.discountPercent)),
    notes: item.notes ?? null,
  }));

  // Determine contact fields
  const patientId = input.patientId ?? null;
  const leadId = input.leadId ?? null;

  return storeCreateBudget({
    clinicId: input.clinicId,
    patientId,
    leadId,
    convertedFromLeadId: null,
    campaignId: input.campaignId ?? null,
    title: input.title ?? null,
    description: input.description ?? null,
    notes: null,
    totalValue: String(totals.totalValue),
    discountPercent: String(totals.discountPercent),
    discountValue: String(totals.discountValue),
    finalValue: String(totals.finalValue),
    status: 'pending',
    validUntil: input.validUntil ?? null,
    sentAt: null,
    acceptedAt: null,
    rejectedAt: null,
    lastSentAt: null,
    items,
  });
}

/**
 * Get a single budget by id.
 */
export async function getBudget(id: string): Promise<BudgetRecord | undefined> {
  return storeGetBudget(id);
}

/**
 * List budgets for a clinic.
 */
export async function listBudgets(clinicId: string, status?: string): Promise<BudgetRecord[]> {
  return storeListBudgets(clinicId, status);
}

/**
 * Accept a budget.
 */
export async function acceptBudget(id: string, clinicId: string, opts?: { patientId?: string; convertedFromLeadId?: string }): Promise<BudgetRecord> {
  const budget = storeGetBudget(id);
  if (!budget) throw new Error('Budget not found');
  if (budget.clinicId !== clinicId) throw new Error('Budget not found');
  if (budget.status !== 'pending') throw new Error(`Budget cannot be accepted in status: ${budget.status}`);

  const patch: Partial<BudgetRecord> = {
    status: 'accepted',
    acceptedAt: new Date().toISOString(),
  };

  if (opts?.patientId) patch.patientId = opts.patientId;
  if (opts?.convertedFromLeadId) patch.convertedFromLeadId = opts.convertedFromLeadId;

  const updated = storeUpdateBudget(id, patch);
  if (!updated) throw new Error('Budget not found');
  return updated;
}

/**
 * Reject a budget.
 */
export async function rejectBudget(id: string, clinicId: string): Promise<BudgetRecord> {
  const budget = storeGetBudget(id);
  if (!budget) throw new Error('Budget not found');
  if (budget.clinicId !== clinicId) throw new Error('Budget not found');

  const updated = storeUpdateBudget(id, {
    status: 'rejected',
    rejectedAt: new Date().toISOString(),
  });
  if (!updated) throw new Error('Budget not found');
  return updated;
}

/**
 * Mark a budget as sent.
 */
export async function markBudgetSent(id: string, clinicId: string): Promise<BudgetRecord> {
  const budget = storeGetBudget(id);
  if (!budget) throw new Error('Budget not found');
  if (budget.clinicId !== clinicId) throw new Error('Budget not found');

  const updated = storeUpdateBudget(id, {
    sentAt: new Date().toISOString(),
    lastSentAt: new Date().toISOString(),
  });
  if (!updated) throw new Error('Budget not found');
  return updated;
}
