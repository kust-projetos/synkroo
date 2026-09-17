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
  getBudgetForClinic as repoGetBudgetForClinic,
  type BudgetRow,
} from '../repositories/financeiro-repository';
import { lineTotalCents, percentOfCents, quantizePriceToCents, centsToDecimal } from './money';

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
 *
 * Etapa 5.1: exact-decimal cents arithmetic (half-up at cent level) — no
 * binary-float math, so `3 × 0.1` is exactly `0.30`. Same return shape.
 *
 * Price rule: unitPrice is quantized to cents (half-up) at the entry
 * boundary, so stored price × quantity == total exactly (numeric(10,2)).
 */
export function calculateBudgetTotals(items: BudgetItemInput[], discountPercent = 0): BudgetTotals {
  const totalCents = items.reduce((sum, item) => {
    const unitCents = quantizePriceToCents(item.unitPrice);
    const q = item.quantity;
    // quantity up to 3 decimals; unit already in cents → single half-up step
    const lineCents = lineTotalCents(q, centsToDecimal(unitCents));
    return sum + lineCents;
  }, 0n);
  const discountCents = discountPercent > 0 ? percentOfCents(totalCents, discountPercent) : 0n;
  const finalCents = totalCents - discountCents >= 0n ? totalCents - discountCents : 0n;
  const toNum = (c: bigint): number => Number(c) / 100;
  return { totalValue: toNum(totalCents), discountPercent, discountValue: toNum(discountCents), finalValue: toNum(finalCents) };
}

function calculateItemTotal(quantity: number, unitPrice: number, discountPercent?: number): number {
  const quantized = centsToDecimal(quantizePriceToCents(unitPrice));
  const subtotalCents = lineTotalCents(quantity, quantized);
  if (!discountPercent || discountPercent <= 0) return Number(subtotalCents) / 100;
  const netCents = subtotalCents - percentOfCents(subtotalCents, discountPercent);
  return Number(netCents) / 100;
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

  // Persist items — clinicId derived from budget tenant-scoped (W2).
  // Unit price is quantized to cents so stored price × qty == total exactly.
  const items = input.items.map(item => ({
    clinicId: input.clinicId,
    budgetId: budget.id,
    procedureName: item.procedureName,
    quantity: item.quantity,
    unitPrice: centsToDecimal(quantizePriceToCents(item.unitPrice)),
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

export async function getBudgetForClinic(id: string, clinicId: string): Promise<BudgetRow | undefined> {
  return repoGetBudgetForClinic(id, clinicId);
}

export async function listBudgets(clinicId: string, status?: string): Promise<BudgetRow[]> {
  return repoListBudgets(clinicId, status);
}

export async function acceptBudget(id: string, clinicId: string, opts?: { patientId?: string; convertedFromLeadId?: string }): Promise<BudgetRow> {
  const budget = await repoGetBudgetForClinic(id, clinicId);
  if (!budget) throw new Error('Budget not found');
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
