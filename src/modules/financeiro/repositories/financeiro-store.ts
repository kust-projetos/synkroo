/**
 * Financeiro — in-memory store.
 *
 * Simulates DB operations for the financeiro module.
 * Used by services until real DB repositories are built.
 * Thread-safe within a single request; NOT for production.
 */

import { assertSingleRoutingScope } from './financeiro-repository';

// ─── Record types ──────────────────────────────────────────────────────────────

export interface BudgetRecord {
  id: string;
  clinicId: string;
  patientId: string | null;
  leadId: string | null;
  convertedFromLeadId: string | null;
  campaignId: string | null;
  title: string | null;
  description: string | null;
  totalValue: string;
  discountPercent: string;
  discountValue: string;
  finalValue: string;
  status: string;
  validUntil: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  lastSentAt: string | null;
  items: BudgetItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface BudgetItemRecord {
  id: string;
  budgetId: string;
  procedureName: string;
  quantity: number;
  unitPrice: string;
  discountPercent: string;
  totalPrice: string;
  notes: string | null;
}

export interface PaymentChargeRecord {
  id: string;
  clinicId: string;
  budgetId: string;
  gatewayId: string;
  externalChargeId: string | null;
  paymentUrl: string | null;
  pixQrCode: string | null;
  dueDate: string;
  amount: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentGatewayRecord {
  id: string;
  clinicId: string;
  provider: string;
  isDefault: boolean;
  isEnabled: boolean;
  maskedLabel: string | null;
  encryptedConfig: Record<string, unknown> | null;
  apiKey: string | null; // raw secret, never returned via API
  createdAt: string;
  updatedAt: string;
}

export interface GatewayRoutingRuleRecord {
  id: string;
  clinicId: string;
  gatewayId: string;
  campaignId: string | null;
  patientId: string | null;
  leadId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface CollectionAttemptRecord {
  id: string;
  clinicId: string;
  chargeId: string | null;
  installmentId: string | null;
  channel: string;
  stage: string;
  status: string;
  sentAt: string;
  errorMessage: string | null;
  createdAt: string;
}

// ─── In-memory stores ──────────────────────────────────────────────────────────

const budgetStore = new Map<string, BudgetRecord>();
const chargeStore = new Map<string, PaymentChargeRecord>();
const gatewayStore = new Map<string, PaymentGatewayRecord>();
const routingRuleStore = new Map<string, GatewayRoutingRuleRecord>();
const paymentStore = new Map<string, PaymentRecord>();
const collectionAttemptStore = new Map<string, CollectionAttemptRecord>();

let idCounter = 0;
function nextId(): string {
  idCounter++;
  return `fin-${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}
function now(): string {
  return new Date().toISOString();
}

// ─── Budget operations ─────────────────────────────────────────────────────────

export function storeCreateBudget(record: Omit<BudgetRecord, 'id' | 'createdAt' | 'updatedAt'>): BudgetRecord {
  const id = nextId();
  const result: BudgetRecord = { ...record, id, createdAt: now(), updatedAt: now() };
  budgetStore.set(id, result);
  return result;
}

export function storeGetBudget(id: string): BudgetRecord | undefined {
  return budgetStore.get(id);
}

export function storeUpdateBudget(id: string, patch: Partial<BudgetRecord>): BudgetRecord | undefined {
  const existing = budgetStore.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch, updatedAt: now() };
  budgetStore.set(id, updated);
  return updated;
}

export function storeListBudgets(clinicId: string, status?: string): BudgetRecord[] {
  const all = Array.from(budgetStore.values());
  return all.filter(b => b.clinicId === clinicId && (!status || b.status === status));
}

export function storeDeleteBudget(id: string): void {
  budgetStore.delete(id);
}

// ─── Charge operations ─────────────────────────────────────────────────────────

export function storeCreateCharge(record: Omit<PaymentChargeRecord, 'id' | 'createdAt' | 'updatedAt'>): PaymentChargeRecord {
  const id = nextId();
  const result: PaymentChargeRecord = { ...record, id, createdAt: now(), updatedAt: now() };
  chargeStore.set(id, result);
  return result;
}

export function storeGetCharge(id: string): PaymentChargeRecord | undefined {
  return chargeStore.get(id);
}

export function storeUpdateCharge(id: string, patch: Partial<PaymentChargeRecord>): PaymentChargeRecord | undefined {
  const existing = chargeStore.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch, updatedAt: now() };
  chargeStore.set(id, updated);
  return updated;
}

export function storeListCharges(clinicId: string, status?: string): PaymentChargeRecord[] {
  const all = Array.from(chargeStore.values());
  return all.filter(c => c.clinicId === clinicId && (!status || c.status === status));
}

export function storeListOverdueCharges(clinicId: string): PaymentChargeRecord[] {
  const today = new Date().toISOString().slice(0, 10);
  return Array.from(chargeStore.values()).filter(
    c => c.clinicId === clinicId && c.status === 'pending' && c.dueDate < today,
  );
}

// ─── Gateway operations ────────────────────────────────────────────────────────

export function storeCreateGateway(record: Omit<PaymentGatewayRecord, 'id' | 'createdAt' | 'updatedAt'>): PaymentGatewayRecord {
  const id = nextId();
  const result: PaymentGatewayRecord = { ...record, id, createdAt: now(), updatedAt: now() };
  gatewayStore.set(id, result);
  return result;
}

export function storeGetGateway(id: string): PaymentGatewayRecord | undefined {
  return gatewayStore.get(id);
}

export function storeUpdateGateway(id: string, patch: Partial<PaymentGatewayRecord>): PaymentGatewayRecord | undefined {
  const existing = gatewayStore.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch, updatedAt: now() };
  gatewayStore.set(id, updated);
  return updated;
}

export function storeListGateways(clinicId: string): PaymentGatewayRecord[] {
  return Array.from(gatewayStore.values()).filter(g => g.clinicId === clinicId);
}

export function storeGetDefaultGateway(clinicId: string): PaymentGatewayRecord | undefined {
  return Array.from(gatewayStore.values()).find(
    g => g.clinicId === clinicId && g.isDefault && g.isEnabled,
  );
}

// ─── Routing rule operations ───────────────────────────────────────────────────

export function storeCreateRoutingRule(record: Omit<GatewayRoutingRuleRecord, 'id' | 'createdAt' | 'updatedAt'>): GatewayRoutingRuleRecord {
  const id = nextId();
  const result: GatewayRoutingRuleRecord = { ...record, id, createdAt: now(), updatedAt: now() };
  routingRuleStore.set(id, result);
  return result;
}

export function storeListRoutingRules(clinicId: string): GatewayRoutingRuleRecord[] {
  return Array.from(routingRuleStore.values()).filter(r => r.clinicId === clinicId);
}

// ─── Payment operations ────────────────────────────────────────────────────────

export function storeCreatePayment(record: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt'>): PaymentRecord {
  const id = nextId();
  const result: PaymentRecord = { ...record, id, createdAt: now(), updatedAt: now() };
  paymentStore.set(id, result);
  return result;
}

export function storeListPayments(budgetId: string): PaymentRecord[] {
  return Array.from(paymentStore.values()).filter(p => p.budgetId === budgetId);
}

// ─── Test helpers ──────────────────────────────────────────────────────────────

/** Reset all stores. Used between tests. */
export function storeReset(): void {
  budgetStore.clear();
  chargeStore.clear();
  gatewayStore.clear();
  routingRuleStore.clear();
  paymentStore.clear();
  collectionAttemptStore.clear();
  idCounter = 0;
}
