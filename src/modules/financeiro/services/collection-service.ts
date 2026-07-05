/**
 * Financeiro — collection service.
 *
 * Overdue charge detection, reminder rules (D+1 light, D+3 firm, D+7 internal),
 * and collection attempt audit trail.
 */

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

export async function sendReminder(input: {
  clinicId: string;
  chargeId: string;
}) {
  // TODO: delegate WhatsApp send through Atendimento
  throw new Error('Not yet implemented');
}
