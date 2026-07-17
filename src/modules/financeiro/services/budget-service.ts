/**
 * Financeiro — budget service.
 *
 * Business logic for CRUD, totals, discounts, and status transitions on budgets.
 * Uses real Drizzle-backed repository.
 */

import {
  createBudget as repoCreateBudget,
  getBudget as repoGetBudget,
  updateBudget as repoUpdateBudget,
  listBudgets as repoListBudgets,
  createBudgetItems,
  type BudgetRow,
} from '../repositories/financeiro-repository';

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
  const totalValue = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountValue = discountPercent > 0
    ? Math.round(totalValue * (discountPercent / 100) * 100) / 100
    : 0;
  const finalValue = Math.max(0, totalValue - discountValue);
  return { totalValue, discountPercent, discountValue, finalValue };
}

function calculateItemTotal(quantity: number, unitPrice: number, discountPercent?: number): number {
  const subtotal = quantity * unitPrice;
  if (!discountPercent || discountPercent <= 0) return subtotal;
  const discount = subtotal * (discountPercent / 100);
  return Math.round((subtotal - discount) * 100) / 100;
}

/**
 * Create a budget with deterministic totals — persisted via Drizzle.
 */
export async function createBudget(input: CreateBudgetInput): Promise<BudgetRow> {
  const totals = calculateBudgetTotals(input.items, input.discountPercent);
  const patientId = input.patientId ?? null;
  const leadId = input.leadId ?? null;

  const budget = await repoCreateBudget({
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
  });

  // Persist items
  const items = input.items.map(item => ({
    budgetId: budget.id,
    procedureName: item.procedureName,
    quantity: item.quantity,
    unitPrice: String(item.unitPrice),
    discountPercent: String(item.discountPercent ?? 0),
    totalPrice: String(calculateItemTotal(item.quantity, item.unitPrice, item.discountPercent)),
    notes: item.notes ?? null,
  }));
  await createBudgetItems(items);

  return budget;
}

export async function getBudget(id: string): Promise<BudgetRow | undefined> {
  return repoGetBudget(id);
}

export async function listBudgets(clinicId: string, status?: string): Promise<BudgetRow[]> {
  return repoListBudgets(clinicId, status);
}

export async function acceptBudget(id: string, clinicId: string, opts?: { patientId?: string; convertedFromLeadId?: string }): Promise<BudgetRow> {
  const budget = await repoGetBudget(id);
  if (!budget) throw new Error('Budget not found');
  if (budget.clinicId !== clinicId) throw new Error('Budget not found');
  if (budget.status !== 'pending') throw new Error(`Budget cannot be accepted in status: ${budget.status}`);

  const patch: Partial<BudgetRow> = {
    status: 'accepted',
    acceptedAt: new Date(),
  };
  if (opts?.patientId) patch.patientId = opts.patientId;
  if (opts?.convertedFromLeadId) patch.convertedFromLeadId = opts.convertedFromLeadId;

  const updated = await repoUpdateBudget(id, patch);
  if (!updated) throw new Error('Budget not found');
  return updated;
}

export async function rejectBudget(id: string, clinicId: string): Promise<BudgetRow> {
  const budget = await repoGetBudget(id);
  if (!budget) throw new Error('Budget not found');
  if (budget.clinicId !== clinicId) throw new Error('Budget not found');

  const updated = await repoUpdateBudget(id, { status: 'rejected', rejectedAt: new Date() });
  if (!updated) throw new Error('Budget not found');
  return updated;
}

export async function markBudgetSent(id: string, clinicId: string): Promise<BudgetRow> {
  const budget = await repoGetBudget(id);
  if (!budget) throw new Error('Budget not found');
  if (budget.clinicId !== clinicId) throw new Error('Budget not found');

  const updated = await repoUpdateBudget(id, { sentAt: new Date(), lastSentAt: new Date() });
  if (!updated) throw new Error('Budget not found');
  return updated;
}
