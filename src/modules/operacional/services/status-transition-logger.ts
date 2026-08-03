/**
 * Appointment Status Transition Logger — REQ-OPS-05
 *
 * Registra toda mudança de estado de consulta com actor, timestamps,
 * e clinicId para auditoria e rastreabilidade.
 */

import { getDb } from '@/lib/db/client';
import { appointmentStatusLog } from '@/lib/db/schema/business';
import { dbLogger } from '@/lib/logger';

export interface StatusTransition {
  clinicId: string;
  appointmentId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  reason?: string;
}

export async function logAppointmentStatusTransition(transition: StatusTransition): Promise<void> {
  try {
    await getDb().insert(appointmentStatusLog).values({
      clinicId: transition.clinicId,
      appointmentId: transition.appointmentId,
      fromStatus: transition.fromStatus,
      toStatus: transition.toStatus,
      changedBy: transition.changedBy,
      reason: transition.reason ?? null,
    });
  } catch (err) {
    dbLogger.error('Failed to log appointment status transition', err, {
      appointmentId: transition.appointmentId,
      toStatus: transition.toStatus,
    });
  }
}
