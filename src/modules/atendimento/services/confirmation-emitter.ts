import { getDb } from '@/lib/db/client';
import { appointments, patients, appointmentConfirmationRequests } from '@/modules/operacional/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getOrCreateConversation } from '../repositories/conversations-repository';
import { sendWhatsAppMessage } from './channel-service';
import { createConfirmationRequest } from '@/modules/operacional/public';
import { whatsappLogger } from '@/lib/logger';

export type EmitConfirmationResult =
  | { ok: true; requestId: string; conversationId: string; deduped: boolean }
  | { ok: false; reason: string; delivery?: 'unknown' };

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

  // Reuse existing pending request: do not send a duplicate prompt.
  if (created.deduped) {
    return { ok: true, requestId: created.id, conversationId, deduped: true };
  }

  const tz = created.clinicTimezone || 'America/Sao_Paulo';
  const scheduledAt = created.appointmentScheduledAt ?? new Date(row.scheduledAt);
  const dateStr = scheduledAt.toLocaleDateString('pt-BR', { timeZone: tz });
  const timeStr = scheduledAt.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const message = `Sua consulta está marcada para ${dateStr} às ${timeStr}. Responda SIM para confirmar.`;

  const idempotencyKey = `confirmation-prompt:${clinicId}:${created.id}`;

  const result = await sendWhatsAppMessage(senderPhone, message, idempotencyKey);

  if (result.success === true) {
    return { ok: true, requestId: created.id, conversationId, deduped: false };
  }

  // Delivery unknown: do NOT retry automatically; require reconciliation.
  if (result.delivery === 'unknown') {
    whatsappLogger.warn('Confirmation prompt delivery unknown — reconciliation required', {
      event: 'CONFIRMATION_PROMPT_DELIVERY_UNKNOWN',
      appointmentId,
      requestId: created.id,
    });
    return { ok: false, reason: 'delivery_unknown', delivery: 'unknown' };
  }

  // Proven non-send failure: invalidate the pending so it does not stay active.
  try {
    await db
      .update(appointmentConfirmationRequests)
      .set({ status: 'expired', outcome: 'send_failed', updatedAt: new Date() } as any)
      .where(and(eq(appointmentConfirmationRequests.id, created.id), eq(appointmentConfirmationRequests.clinicId, clinicId)));
  } catch {
    // best effort
  }
  whatsappLogger.error('Confirmation prompt send failed', null, {
    event: 'CONFIRMATION_PROMPT_SEND_FAILED',
    appointmentId,
    requestId: created.id,
  });
  return { ok: false, reason: 'send_failed' };
}

export async function processAllConfirmationPrompts(): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  try {
    const db = getDb();
    const now = new Date();
    // Janela ampliada (23h..25h) para tolerar drift do cron de 5 min sem
    // perder consultas elegíveis; a dedup de createConfirmationRequest evita
    // reenvio. Filtro indexável por scheduledAt + status (sem varredura total).
    const windowStart = new Date(now.getTime() + 23 * 3_600_000);
    const windowEnd = new Date(now.getTime() + 25 * 3_600_000);
    const rows = await db
      .select({ id: appointments.id, clinicId: appointments.clinicId, scheduledAt: appointments.scheduledAt })
      .from(appointments)
      .where(and(
        eq(appointments.status, 'scheduled' as any),
        gte(appointments.scheduledAt, windowStart),
        lte(appointments.scheduledAt, windowEnd),
      ));
    for (const appt of rows) {
      try {
        const r = await emitConfirmationPrompt((appt as any).id, (appt as any).clinicId);
        if (r.ok) processed++;
      } catch {
        errors++;
      }
    }
  } catch {
    errors++;
  }
  return { processed, errors };
}
