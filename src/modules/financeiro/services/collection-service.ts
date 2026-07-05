/**
 * Financeiro — collection service.
 *
 * Overdue charge detection, reminder rules (D+1 light, D+3 firm, D+7 internal),
 * and collection attempt audit trail.
 */

import { storeListOverdueCharges, type PaymentChargeRecord } from '../repositories/financeiro-store';

/**
 * Determine collection stage based on days overdue.
 * MVP régua: D+1 light, D+3 firm, D+7 internal alert.
 */
export function getCollectionStage(daysOverdue: number): 'none' | 'light' | 'firm' | 'internal' {
  if (daysOverdue >= 7) return 'internal';
  if (daysOverdue >= 3) return 'firm';
  if (daysOverdue >= 1) return 'light';
  return 'none';
}

/**
 * List overdue charges for a clinic.
 * Returns charges with status 'pending' and dueDate before today.
 */
export async function listOverdueCharges(clinicId: string): Promise<PaymentChargeRecord[]> {
  return storeListOverdueCharges(clinicId);
}

/**
 * Calculate days overdue from a due date.
 */
export function calculateDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

export interface OverdueChargeWithStage extends PaymentChargeRecord {
  daysOverdue: number;
  collectionStage: 'none' | 'light' | 'firm' | 'internal';
}

/**
 * Enrich overdue charges with collection stage info.
 */
export function enrichOverdueCharges(charges: PaymentChargeRecord[]): OverdueChargeWithStage[] {
  return charges.map(charge => {
    const daysOverdue = calculateDaysOverdue(charge.dueDate);
    return {
      ...charge,
      daysOverdue,
      collectionStage: getCollectionStage(daysOverdue),
    };
  });
}

/**
 * Send a collection reminder (delegates to Atendimento).
 * Stub — real WhatsApp integration will be added in Task 6.
 */
export async function sendReminder(_input: {
  clinicId: string;
  chargeId: string;
}): Promise<{ sent: boolean }> {
  // TODO: delegate WhatsApp send through Atendimento action
  return { sent: true };
}
