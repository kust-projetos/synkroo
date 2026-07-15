/**
 * Financeiro — collection service.
 *
 * Overdue charge detection, reminder rules, WhatsApp send via Atendimento.
 * Uses real Drizzle-backed repository.
 */

import { listOverdueCharges as repoListOverdue, type PaymentChargeRow } from '../repositories/financeiro-repository';
import { getPaymentChargeForClinic } from '../repositories/financeiro-scope-repository';

export function getCollectionStage(daysOverdue: number): 'none' | 'light' | 'firm' | 'internal' {
  if (daysOverdue >= 7) return 'internal';
  if (daysOverdue >= 3) return 'firm';
  if (daysOverdue >= 1) return 'light';
  return 'none';
}

export async function listOverdueCharges(clinicId: string): Promise<PaymentChargeRow[]> {
  return repoListOverdue(clinicId);
}

export function calculateDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

export interface OverdueChargeWithStage extends PaymentChargeRow {
  daysOverdue: number;
  collectionStage: 'none' | 'light' | 'firm' | 'internal';
}

export function enrichOverdueCharges(charges: PaymentChargeRow[]): OverdueChargeWithStage[] {
  return charges.map(charge => {
    const daysOverdue = calculateDaysOverdue(charge.dueDate);
    return { ...charge, daysOverdue, collectionStage: getCollectionStage(daysOverdue) };
  });
}

/**
 * Resolve a patient's phone number from a charge's budget.
 * Uses scoped queries so foreign charges/budgets/patients return null.
 * Returns null if the charge has no budget, the budget has no patient,
 * or the patient has no phone.
 */
async function resolvePatientPhone(clinicId: string, chargeId: string): Promise<string | null> {
  try {
    const charge = await getPaymentChargeForClinic(chargeId, clinicId);
    if (!charge?.budgetId) return null;

    const { getBudgetForClinic } = await import('../repositories/financeiro-scope-repository');
    const budget = await getBudgetForClinic(charge.budgetId, clinicId);
    if (!budget?.patientId) return null;

    // Query patient phone — scoped by clinicId
    const { getDb } = await import('@/lib/db/client');
    const { eq, and } = await import('drizzle-orm');
    const { patients } = await import('@/lib/db/schema');

    const db = getDb();
    const [patient] = await db
      .select({ phone: patients.phone })
      .from(patients)
      .where(and(eq(patients.id, budget.patientId), eq(patients.clinicId, clinicId)))
      .limit(1);

    if (!patient) return null;
    return patient.phone || null;
  } catch {
    return null;
  }
}

/**
 * Send a collection reminder via WhatsApp through the Atendimento subsystem.
 *
 * 1. If `patientPhone` is not provided, resolves from charge → budget → patient.
 * 2. Calls `atendimento.enviarMensagemDireta` with the phone and reminder message.
 * 3. Returns result with sent status and optional error.
 */
export async function sendReminder(input: {
  clinicId: string;
  chargeId: string;
  patientPhone?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const { clinicId, chargeId } = input;
  let patientPhone = input.patientPhone;

  // ALWAYS validate charge belongs to clinic before processing
  const charge = await getPaymentChargeForClinic(chargeId, clinicId);
  if (!charge) {
    return { sent: false, error: 'missing_patient_phone' };
  }

  // Resolve phone if not provided
  if (!patientPhone) {
    patientPhone = await resolvePatientPhone(clinicId, chargeId) ?? undefined;
  }

  if (!patientPhone) {
    return { sent: false, error: 'missing_patient_phone' };
  }

  try {
    const { enviarMensagemDireta } = await import('@/modules/atendimento/actions/enviar-mensagem-direta');
    const { runAction } = await import('@/core/actions/run');
    const { buildSystemContext } = await import('@/core/actions/context');

    const ctx = await buildSystemContext(clinicId);
    const message = 'Lembrete: sua cobrança está pendente. Entre em contato para regularizar.';

    const result = await runAction(enviarMensagemDireta, {
      channel: 'whatsapp',
      externalId: patientPhone,
      message,
    }, ctx);

    if (result.ok) return { sent: true };
    return { sent: false, error: result.error.message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { sent: false, error: msg };
  }
}
