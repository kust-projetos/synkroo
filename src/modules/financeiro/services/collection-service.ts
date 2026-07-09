/**
 * Financeiro — collection service.
 *
 * Overdue charge detection, reminder rules, and collection attempt audit trail.
 * Uses real Drizzle-backed repository.
 */

import { listOverdueCharges as repoListOverdue, type PaymentChargeRow } from '../repositories/financeiro-repository';

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

export async function sendReminder(_input: {
  clinicId: string;
  chargeId: string;
}): Promise<{ sent: boolean; error?: string }> {
  // WhatsApp send through Atendimento requires patient phone resolution
  // which needs cross-module coordination beyond this slice scope.
  // Return clear failure instead of fake success.
  return { sent: false, error: 'whatsapp_integration_pending' };
}
