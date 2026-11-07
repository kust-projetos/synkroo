import { getDb } from '@/lib/db/client';
import { appointments, patients, appointmentConfirmationRequests } from '@/modules/operacional/schema';
import { eq, and } from 'drizzle-orm';
import { getOrCreateConversation } from '../repositories/conversations-repository';
import { sendWhatsAppMessage } from './channel-service';
import { createConfirmationRequest } from '@/modules/operacional/public';
import { whatsappLogger } from '@/lib/logger';

export type EmitConfirmationResult =
  | { ok: true; requestId: string; conversationId: string }
  | { ok: false; reason: string };

export async function emitConfirmationPrompt(
  appointmentId: string,
  clinicId: string,
): Promise<EmitConfirmationResult> {
  const db = getDb();

  const [row] = await db
    .select({
      id: appointments.id,
      clinicId: appointments.clinicId,
      patientId: appointments.patientId,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
    })
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicId, clinicId)))
    .limit(1);

  if (!row) return { ok: false, reason: 'appointment_not_found' };
  if (row.status !== 'scheduled') return { ok: false, reason: 'not_scheduled' };

  const [patient] = await db
    .select({ id: patients.id, name: patients.name, phone: patients.phone })
    .from(patients)
    .where(and(eq(patients.id, row.patientId), eq(patients.clinicId, clinicId)))
    .limit(1);

  if (!patient?.phone) return { ok: false, reason: 'no_patient_phone' };

  const senderPhone = String(patient.phone).replace(/\D/g, '');
  if (!senderPhone) return { ok: false, reason: 'no_patient_phone' };

  const conversationId = await getOrCreateConversation(clinicId, 'whatsapp', senderPhone, patient.phone);

  const tz = 'America/Sao_Paulo';

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  let created: { id: string; deduped: boolean; appointmentScheduledAt: Date; clinicTimezone: string };
  try {
    created = await createConfirmationRequest({
      clinicId,
      appointmentId,
      conversationId,
      senderPhone,
      expiresAt,
    });
  } catch {
    return { ok: false, reason: 'confirmation_not_created' };
  }

  const requestId = created.id;
  const scheduledAt = created.appointmentScheduledAt ?? new Date(row.scheduledAt);
  const dateStr = scheduledAt.toLocaleDateString('pt-BR', { timeZone: tz });
  const timeStr = scheduledAt.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const message = `Sua consulta está marcada para ${dateStr} às ${timeStr}. Responda SIM para confirmar.`;

  let sent = false;
  try {
    const res = await sendWhatsAppMessage(clinicId, senderPhone, message);
    sent = !!res;
  } catch {
    sent = false;
  }

  if (!sent) {
    // Invalidate the pending so it does not stay active without a delivered prompt.
    try {
      await db.update(appointmentConfirmationRequests).set({
        status: 'expired',
        outcome: 'send_failed',
        updatedAt: new Date(),
      } as any).where(eq(appointmentConfirmationRequests.id, requestId));
    } catch {
      // best effort
    }
    whatsappLogger.error('Confirmation prompt send failed', null, { event: 'CONFIRMATION_PROMPT_SEND_FAILED', appointmentId, requestId });
    return { ok: false, reason: 'send_failed' };
  }

  return { ok: true, requestId, conversationId };
}
