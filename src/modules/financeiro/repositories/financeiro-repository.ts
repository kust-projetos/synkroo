/**
 * Financeiro — Drizzle-backed repository.
 *
 * Every function uses real Drizzle queries against the shared DB handle.
 * Replaces the in-memory financeiro-store for all runtime paths.
 */

import { eq, and, desc, sql, lte } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  budgets,
  budgetItems,
  budgetInstallments,
  payments,
  paymentCharges,
  paymentGateways,
  gatewayRoutingRules,
  gatewayEvents,
  collectionAttempts,
} from '@/lib/db/schema';
import type { InferSelectModel } from 'drizzle-orm';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type BudgetRow = InferSelectModel<typeof budgets>;
export type PaymentChargeRow = InferSelectModel<typeof paymentCharges>;
export type PaymentGatewayRow = InferSelectModel<typeof paymentGateways>;
export type GatewayRoutingRuleRow = InferSelectModel<typeof gatewayRoutingRules>;
export type GatewayEventRow = InferSelectModel<typeof gatewayEvents>;
export type PaymentRow = InferSelectModel<typeof payments>;
export type CollectionAttemptRow = InferSelectModel<typeof collectionAttempts>;

export interface RoutingScope {
  campaignId?: string | null;
  patientId?: string | null;
  leadId?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Assert that a gateway routing rule targets exactly one scope.
 */
export function assertSingleRoutingScope(rule: RoutingScope): void {
  const count = [rule.campaignId, rule.patientId, rule.leadId].filter(Boolean).length;
  if (count !== 1) {
    throw new Error('gateway_routing_rule_scope_conflict');
  }
}

export interface ChargeInsertInput {
  clinicId: string;
  budgetId: string;
  gatewayId: string;
  amount: number;
  dueDate: string;
}

/**
 * Build a minimal payment_charges insert row from validated input.
 */
export function buildChargeInsert(input: ChargeInsertInput) {
  return {
    clinicId: input.clinicId,
    budgetId: input.budgetId,
    gatewayId: input.gatewayId,
    amount: String(input.amount),
    dueDate: input.dueDate,
    status: 'pending' as const,
  };
}

// ─── Budget CRUD ───────────────────────────────────────────────────────────────

export async function createBudget(data: {
  clinicId: string;
  patientId: string | null;
  leadId: string | null;
  convertedFromLeadId: string | null;
  campaignId: string | null;
  title: string | null;
  description: string | null;
  notes: string | null;
  totalValue: string;
  discountPercent: string;
  discountValue: string;
  finalValue: string;
  status: string;
  validUntil: string | null;
}): Promise<BudgetRow> {
  const db = getDb();
  const [row] = await db.insert(budgets).values({
    clinicId: data.clinicId,
    patientId: data.patientId,
    leadId: data.leadId,
    convertedFromLeadId: data.convertedFromLeadId,
    campaignId: data.campaignId,
    title: data.title,
    description: data.description,
    notes: data.notes,
    totalValue: data.totalValue,
    discountPercent: data.discountPercent,
    discountValue: data.discountValue,
    finalValue: data.finalValue,
    status: data.status,
    validUntil: data.validUntil ? new Date(data.validUntil) : null,
  }).returning();
  return row;
}

export async function getBudget(id: string): Promise<BudgetRow | undefined> {
  const db = getDb();
  const [row] = await db.select().from(budgets).where(eq(budgets.id, id)).limit(1);
  return row;
}

export async function updateBudget(id: string, patch: Partial<BudgetRow>): Promise<BudgetRow | undefined> {
  const db = getDb();
  const [row] = await db.update(budgets).set({ ...patch, updatedAt: new Date() }).where(eq(budgets.id, id)).returning();
  return row;
}

export async function listBudgets(clinicId: string, status?: string): Promise<BudgetRow[]> {
  const db = getDb();
  const conditions = [eq(budgets.clinicId, clinicId)];
  if (status) conditions.push(eq(budgets.status, status));
  return db.select().from(budgets).where(and(...conditions)).orderBy(desc(budgets.createdAt));
}

export async function deleteBudgetDb(id: string): Promise<void> {
  const db = getDb();
  await db.delete(budgets).where(eq(budgets.id, id));
}

// ─── Budget Installment CRUD ────────────────────────────────────────────────────

export type BudgetInstallmentRow = InferSelectModel<typeof budgetInstallments>;

export async function createInstallments(data: Array<{
  budgetId: string;
  amount: string;
  dueDate: string;
  status: string;
}>): Promise<BudgetInstallmentRow[]> {
  const db = getDb();
  if (data.length === 0) return [];
  return db.insert(budgetInstallments).values(data).returning();
}

export async function listInstallments(budgetId: string): Promise<BudgetInstallmentRow[]> {
  const db = getDb();
  return db.select().from(budgetInstallments).where(eq(budgetInstallments.budgetId, budgetId)).orderBy(budgetInstallments.dueDate);
}

export async function deleteInstallmentsByBudget(budgetId: string): Promise<void> {
  const db = getDb();
  await db.delete(budgetInstallments).where(eq(budgetInstallments.budgetId, budgetId));
}

export async function getInstallment(id: string): Promise<BudgetInstallmentRow | undefined> {
  const db = getDb();
  const [row] = await db.select().from(budgetInstallments).where(eq(budgetInstallments.id, id)).limit(1);
  return row;
}

export async function updateInstallment(id: string, patch: Partial<BudgetInstallmentRow>): Promise<BudgetInstallmentRow | undefined> {
  const db = getDb();
  const [row] = await db.update(budgetInstallments).set({ ...patch, updatedAt: new Date() }).where(eq(budgetInstallments.id, id)).returning();
  return row;
}

export async function deleteInstallment(id: string): Promise<void> {
  const db = getDb();
  await db.delete(budgetInstallments).where(eq(budgetInstallments.id, id));
}

// ─── PaymentCharge CRUD ────────────────────────────────────────────────────────

export async function createPaymentCharge(data: {
  clinicId: string;
  budgetId: string;
  gatewayId: string;
  externalChargeId: string | null;
  paymentUrl: string | null;
  pixQrCode: string | null;
  dueDate: string;
  amount: string;
  status: string;
}): Promise<PaymentChargeRow> {
  const db = getDb();
  const [row] = await db.insert(paymentCharges).values({
    clinicId: data.clinicId,
    budgetId: data.budgetId,
    gatewayId: data.gatewayId,
    externalChargeId: data.externalChargeId,
    paymentUrl: data.paymentUrl,
    pixQrCode: data.pixQrCode,
    dueDate: data.dueDate,
    amount: data.amount,
    status: data.status,
  }).returning();
  return row;
}

export async function getPaymentCharge(id: string): Promise<PaymentChargeRow | undefined> {
  const db = getDb();
  const [row] = await db.select().from(paymentCharges).where(eq(paymentCharges.id, id)).limit(1);
  return row;
}

export async function findPaymentChargeByBudget(clinicId: string, budgetId: string): Promise<PaymentChargeRow | undefined> {
  const db = getDb();
  const [row] = await db.select().from(paymentCharges).where(and(
    eq(paymentCharges.clinicId, clinicId),
    eq(paymentCharges.budgetId, budgetId),
  )).limit(1);
  return row;
}

export async function findPaymentChargeByExternalId(clinicId: string, externalChargeId: string): Promise<PaymentChargeRow | undefined> {
  const db = getDb();
  const [row] = await db.select().from(paymentCharges)
    .where(and(
      eq(paymentCharges.clinicId, clinicId),
      eq(paymentCharges.externalChargeId, externalChargeId),
    ))
    .limit(1);
  return row;
}

export async function updatePaymentCharge(id: string, patch: Partial<PaymentChargeRow>): Promise<PaymentChargeRow | undefined> {
  const db = getDb();
  const [row] = await db.update(paymentCharges).set({ ...patch, updatedAt: new Date() }).where(eq(paymentCharges.id, id)).returning();
  return row;
}

export async function listOverdueCharges(clinicId: string): Promise<PaymentChargeRow[]> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.select().from(paymentCharges)
    .where(and(
      eq(paymentCharges.clinicId, clinicId),
      eq(paymentCharges.status, 'pending'),
      sql`${paymentCharges.dueDate} < ${today}`,
    ))
    .orderBy(desc(paymentCharges.createdAt));
}

// ─── PaymentGateway CRUD ───────────────────────────────────────────────────────

export async function createPaymentGateway(data: {
  clinicId: string;
  provider: string;
  isDefault: boolean;
  isEnabled: boolean;
  maskedLabel: string | null;
  encryptedConfig: Record<string, unknown> | null;
}): Promise<PaymentGatewayRow> {
  const db = getDb();
  const [row] = await db.insert(paymentGateways).values(data).returning();
  return row;
}

export async function getPaymentGateway(id: string): Promise<PaymentGatewayRow | undefined> {
  const db = getDb();
  const [row] = await db.select().from(paymentGateways).where(eq(paymentGateways.id, id)).limit(1);
  return row;
}

export async function listGateways(clinicId: string): Promise<PaymentGatewayRow[]> {
  const db = getDb();
  return db.select().from(paymentGateways).where(eq(paymentGateways.clinicId, clinicId));
}

export async function getDefaultGateway(clinicId: string): Promise<PaymentGatewayRow | undefined> {
  const db = getDb();
  const [row] = await db.select().from(paymentGateways)
    .where(and(eq(paymentGateways.clinicId, clinicId), eq(paymentGateways.isDefault, true), eq(paymentGateways.isEnabled, true)))
    .limit(1);
  return row;
}

export async function updatePaymentGateway(id: string, patch: Partial<PaymentGatewayRow>): Promise<PaymentGatewayRow | undefined> {
  const db = getDb();
  const [row] = await db.update(paymentGateways).set({ ...patch, updatedAt: new Date() }).where(eq(paymentGateways.id, id)).returning();
  return row;
}

// ─── GatewayRoutingRule CRUD ────────────────────────────────────────────────────

export async function createRoutingRule(data: {
  clinicId: string;
  gatewayId: string;
  campaignId: string | null;
  patientId: string | null;
  leadId: string | null;
}): Promise<GatewayRoutingRuleRow> {
  const db = getDb();
  const [row] = await db.insert(gatewayRoutingRules).values(data).returning();
  return row;
}

export async function listRoutingRules(clinicId: string): Promise<GatewayRoutingRuleRow[]> {
  const db = getDb();
  return db.select().from(gatewayRoutingRules).where(eq(gatewayRoutingRules.clinicId, clinicId));
}

// ─── GatewayEvent CRUD ──────────────────────────────────────────────────────────

export async function createGatewayEvent(data: {
  clinicId: string;
  gatewayId: string;
  chargeId: string | null;
  provider: string;
  externalEventId: string;
  payload: Record<string, unknown> | null;
  processedAt: Date | null;
}): Promise<GatewayEventRow> {
  const db = getDb();
  const [row] = await db.insert(gatewayEvents).values(data).returning();
  return row;
}

export async function findGatewayEvent(provider: string, externalEventId: string): Promise<GatewayEventRow | undefined> {
  const db = getDb();
  const [row] = await db.select().from(gatewayEvents)
    .where(and(eq(gatewayEvents.provider, provider), eq(gatewayEvents.externalEventId, externalEventId)))
    .limit(1);
  return row;
}

export async function processGatewayEventAtomically(input: {
  clinicId: string;
  gatewayId: string;
  provider: string;
  externalEventId: string;
  externalChargeId: string;
  payload: Record<string, unknown>;
  settlement: boolean;
  amount: string;
  paidAt: string;
}): Promise<{ settled: boolean; duplicate?: boolean; chargeFound: boolean }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [charge] = await tx.select().from(paymentCharges).where(and(
      eq(paymentCharges.clinicId, input.clinicId),
      eq(paymentCharges.externalChargeId, input.externalChargeId),
    )).limit(1);
    if (!charge) return { settled: false, chargeFound: false };

    const [event] = await tx.insert(gatewayEvents).values({
      clinicId: input.clinicId,
      gatewayId: input.gatewayId,
      chargeId: charge.id,
      provider: input.provider,
      externalEventId: input.externalEventId,
      payload: input.payload,
      processedAt: null,
    }).onConflictDoNothing().returning({ id: gatewayEvents.id });
    if (!event) return { settled: false, duplicate: true, chargeFound: true };

    if (input.settlement) {
      await tx.insert(payments).values({
        clinicId: input.clinicId,
        budgetId: charge.budgetId,
        chargeId: charge.id,
        patientId: null,
        amount: input.amount,
        paymentMethod: 'pix',
        status: 'settled',
        paidAt: new Date(input.paidAt),
        notes: `Asaas webhook: ${input.externalEventId}`,
        createdBy: null,
      }).onConflictDoNothing();
      await tx.update(paymentCharges).set({ status: 'paid', paidAt: new Date(input.paidAt), updatedAt: new Date() })
        .where(and(eq(paymentCharges.id, charge.id), eq(paymentCharges.clinicId, input.clinicId)));
    }
    await tx.update(gatewayEvents).set({ processedAt: new Date() }).where(eq(gatewayEvents.id, event.id));
    return { settled: input.settlement, chargeFound: true };
  });
}

// ─── Payment CRUD ───────────────────────────────────────────────────────────────

export async function createPayment(data: {
  clinicId: string | null;
  budgetId: string | null;
  chargeId: string | null;
  patientId: string | null;
  amount: string;
  paymentMethod: string;
  status: string | null;
  paidAt: string;
  notes: string | null;
  createdBy: string | null;
}): Promise<PaymentRow> {
  const db = getDb();
  const [row] = await db.insert(payments).values({
    clinicId: data.clinicId,
    budgetId: data.budgetId,
    chargeId: data.chargeId,
    patientId: data.patientId,
    amount: data.amount,
    paymentMethod: data.paymentMethod,
    status: data.status,
    paidAt: new Date(data.paidAt),
    notes: data.notes,
    createdBy: data.createdBy,
  }).returning();
  return row;
}

export async function listPaymentsByBudget(budgetId: string): Promise<PaymentRow[]> {
  const db = getDb();
  return db.select().from(payments).where(eq(payments.budgetId, budgetId));
}

// ─── CollectionAttempt CRUD ─────────────────────────────────────────────────────

export async function createCollectionAttempt(data: {
  clinicId: string;
  chargeId: string | null;
  installmentId: string | null;
  channel: string;
  stage: string;
  status: string;
  sentAt: string;
  errorMessage: string | null;
}): Promise<CollectionAttemptRow> {
  const db = getDb();
  const [row] = await db.insert(collectionAttempts).values({
    ...data,
    sentAt: new Date(data.sentAt),
  }).returning();
  return row;
}

// ─── Budget items ───────────────────────────────────────────────────────────────

export async function createBudgetItems(data: Array<{
  budgetId: string;
  procedureName: string;
  quantity: number;
  unitPrice: string;
  discountPercent: string;
  totalPrice: string;
  notes: string | null;
}>): Promise<void> {
  const db = getDb();
  if (data.length > 0) {
    await db.insert(budgetItems).values(data as any);
  }
}
