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
import { withIdempotency } from '@/lib/idempotency';
import { payments, paymentCharges, budgets, budgetInstallments } from '@/modules/financeiro/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
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
  /** Client-supplied idempotency key (from `Idempotency-Key` header). Optional — absent = legacy behavior. */
  idempotencyKey?: string;
}

function toCents(value: string | number): bigint {
  const str = typeof value === 'number' ? value.toFixed(2) : String(value).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(str)) throw new ActionError('invalid_input', 'Valor inválido');
  const [intPart, decPart = ''] = str.split('.');
  const paddedDec = (decPart + '00').slice(0, 2);
  const cents = BigInt(intPart) * 100n + (intPart.startsWith('-') ? -BigInt(paddedDec) : BigInt(paddedDec));
  // Handle -0 case
  if (intPart === '-0' || intPart === '-00') return -BigInt(paddedDec);
  return cents;
}

function centsToDecimal(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  const intPart = abs / 100n;
  const decPart = (abs % 100n).toString().padStart(2, '0');
  return `${sign}${intPart.toString()}.${decPart}`;
}

export async function registerManualPayment(input: RegisterManualPaymentInput): Promise<PaymentRow> {
  const { clinicId, budgetId, chargeId, amount, paymentMethod, notes, actorUserId } = input;
  const paidAt = input.paidAt ?? new Date().toISOString();
  const db = getDb();

  // Validate amount early (outside tx for fast-fail) — must be positive with max 2 decimals
  const amountCents = toCents(amount);
  if (amountCents <= 0n) throw new ActionError('invalid_input', 'Valor deve ser positivo');

  const executeCore = (): Promise<PaymentRow> => db.transaction(async (tx) => {
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

    // Calculate remaining balance server-side under lock — sum of settled payments for this budget
    const existingPayments: any[] = await tx.select().from(payments).where(and(eq(payments.budgetId, budgetId), eq(payments.clinicId, clinicId)));
    const totalPaidCents = existingPayments.reduce((sum: bigint, p: any) => sum + toCents(p.amount), 0n);
    const finalValueCents = toCents(budgetRow.finalValue ?? budgetRow.totalValue ?? '0');
    const remainingCents = finalValueCents - totalPaidCents;
    if (remainingCents <= 0n) throw new ActionError('conflict', 'Orçamento já quitado');
    if (amountCents > remainingCents) throw new ActionError('invalid_input', `Valor acima do saldo devedor. Saldo: ${centsToDecimal(remainingCents)}`);

    // If chargeId supplied, validate charge belongs to same clinic and budget, and apply CAS for status
    let chargeRow: any = null;
    if (chargeId) {
      const [charge] = await tx.select().from(paymentCharges).where(and(eq(paymentCharges.id, chargeId), eq(paymentCharges.clinicId, clinicId))).limit(1);
      if (!charge) {
        throw new ActionError('not_found', 'Charge not found');
      }
      if (charge.budgetId !== budgetId) {
        throw new ActionError('not_found', 'Charge does not belong to budget');
      }
      chargeRow = charge;
      // Only allow transition from non-terminal states; terminal: cancelled, refunded, refund_pending etc.
      const terminal = new Set(['cancelled', 'refunded', 'refund_pending', 'chargeback']);
      if (terminal.has(charge.status)) throw new ActionError('conflict', `Cobrança em estado terminal: ${charge.status}`);
      // For manual payment, if amount covers remaining, mark paid; otherwise keep pending/partially_paid
      // We will update charge status after payment insertion based on whether total will be settled
      const willBeSettled = totalPaidCents + amountCents >= finalValueCents;
      const newStatus = willBeSettled ? 'paid' : 'partially_paid';
      // CAS: only update if still in expected status (avoid race)
      await tx.update(paymentCharges).set({ status: newStatus, paidAt: willBeSettled ? new Date(paidAt) : charge.paidAt, updatedAt: new Date() })
        .where(and(eq(paymentCharges.id, chargeId), eq(paymentCharges.clinicId, clinicId), eq(paymentCharges.status, charge.status)));
    }

    const amountDecimal = centsToDecimal(amountCents);
    const [payment] = await tx.insert(payments).values({
      clinicId,
      budgetId,
      chargeId: chargeId ?? null,
      patientId: budgetRow.patientId ?? null,
      amount: amountDecimal,
      paymentMethod,
      status: 'settled',
      paidAt: new Date(paidAt),
      notes: notes ?? null,
      createdBy: actorUserId,
    }).returning();

    // Update installments within same transaction — mark earliest pending installments as paid until amount covered
    // Fetch pending installments ordered by dueDate
    const pendingInstallments: any[] = await tx.select().from(budgetInstallments).where(and(eq(budgetInstallments.budgetId, budgetId), eq(budgetInstallments.status, 'pending'))).orderBy(budgetInstallments.dueDate);
    let remainingToAllocate = amountCents;
    for (const inst of pendingInstallments) {
      if (remainingToAllocate <= 0n) break;
      const instCents = toCents(inst.amount);
      if (instCents <= 0n) continue;
      if (remainingToAllocate >= instCents) {
        await tx.update(budgetInstallments).set({ status: 'paid', paidAt: new Date(paidAt), paymentId: payment.id, updatedAt: new Date() }).where(eq(budgetInstallments.id, inst.id));
        remainingToAllocate -= instCents;
      } else {
        // Partial coverage of an installment — keep pending, but could mark partially_paid if needed
        // For now, leave as pending; the next payment will cover remainder
        break;
      }
    }

    return payment as PaymentRow;
  });

  const rawKey = input.idempotencyKey?.trim();
  if (!rawKey) return executeCore();

  // Idempotent registration (padrão charge-service): primeira execução processa,
  // duplicata retorna o pagamento original via vínculo resultado→chave
  // (result_ref), sem reinserir. Fingerprint
  // 'budget|amount-cents|method|charge|paidAt|notes' vincula a chave ao
  // payload: mesma chave + payload divergente → conflito (409), nunca reuso
  // de outra requisição. Campos opcionais normalizados como '' (ordem estável).
  // paidAt usa o input bruto (não o default `new Date()` por chamada):
  // default server-side é ruído por tentativa e quebraria retry idêntico.
  const namespaced = `payment:manual:${clinicId}:${budgetId}:${rawKey}`;
  const fingerprint = `${budgetId}|${amountCents.toString()}|${paymentMethod}|${chargeId ?? ''}|${input.paidAt ?? ''}|${notes ?? ''}`;
  const outcome = await withIdempotency(namespaced, 'payment_manual', executeCore, fingerprint, {
    resultRef: (payment) => (payment as PaymentRow | undefined)?.id,
  });
  if (outcome.status === 'completed' && outcome.result) return outcome.result;
  if (outcome.status === 'conflict') {
    throw new ActionError('conflict', 'Pagamento em processamento. Tente novamente.');
  }
  // Replay vinculado: result_ref → busca POR ID com filtro de clínica
  // (tenant-scoped). Só sem vínculo (crash entre insert e update) cai no
  // lookup por domínio, RESTRITO a created_at >= claimedAt do claim.
  if (outcome.resultRef) {
    const [bound] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.id, outcome.resultRef), eq(payments.clinicId, clinicId)))
      .limit(1);
    if (bound) return bound as PaymentRow;
  }
  const expectedAmount = centsToDecimal(amountCents);
  const replayConditions = [eq(payments.clinicId, clinicId), eq(payments.budgetId, budgetId)];
  if (outcome.claimedAt) replayConditions.push(gte(payments.createdAt, outcome.claimedAt));
  const candidates = await db
    .select()
    .from(payments)
    .where(and(...replayConditions))
    .orderBy(desc(payments.createdAt))
    .limit(10);
  const original = candidates.find(
    (p: any) => String(p.amount) === expectedAmount && p.paymentMethod === paymentMethod,
  );
  if (original) return original as PaymentRow;
  throw new ActionError('conflict', 'Pagamento em processamento. Tente novamente.');
}

export async function listPayments(clinicId: string, budgetId: string): Promise<PaymentRow[]> {
  const budget = await getBudgetForClinic(budgetId, clinicId);
  if (!budget) {
    throw new ActionError('not_found', 'Budget not found');
  }
  return repoListPayments(clinicId, budgetId);
}
