/**
 * Reminders service — ported from src/services/reminders/reminder.service.ts
 * Uses operational schema for appointments and reminders.
 */

import { getDb } from '@/lib/db/client';
import { appointments, appointmentReminders } from '../schema/appointments';
import { patients } from '../schema/patients';
import { eq, and, gte, lte, or } from 'drizzle-orm';
import { createQueuedReminder, findAppointmentWithJoins, markReminderTriggered } from '../repositories/reminders-repository';
import { whatsappLogger } from '@/lib/logger';
import { getEffectiveConfig, replacePlaceholders } from './procedure-reminder-config-service';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReminderAppointment = {
  id: string;
  scheduledAt: Date;
  clinicId: string;
  patientId: string;
  dentistId: string | null;
  procedureId: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function getAppointmentsNeedingReminders(hoursBefore: number): Promise<ReminderAppointment[]> {
  const db = getDb();
  const now = new Date();
  const reminderTime = new Date(now.getTime() + hoursBefore * 3_600_000);
  const windowStart = reminderTime;
  const windowEnd = new Date(reminderTime.getTime() + 5 * 60_000);

  const rows = await db
    .select({
      id: appointments.id,
      scheduledAt: appointments.scheduledAt,
      clinicId: appointments.clinicId,
      patientId: appointments.patientId,
      dentistId: appointments.dentistId,
      procedureId: appointments.procedureId,
    })
    .from(appointments)
    .where(
      and(
        gte(appointments.scheduledAt, windowStart),
        lte(appointments.scheduledAt, windowEnd),
        eq(appointments.status, hoursBefore === 24 ? ('confirmed' as const) : 'confirmed'),
      ),
    );

  return rows;
}

export async function hasReminderBeenSent(appointmentId: string, reminderType: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ appointmentId: appointmentReminders.appointmentId })
    .from(appointmentReminders)
    .where(
      and(
        eq(appointmentReminders.appointmentId, appointmentId),
        eq(appointmentReminders.reminderType, reminderType),
        or(eq(appointmentReminders.status, 'sent'), eq(appointmentReminders.status, 'queued')),
      ),
    )
    .limit(1);
  return !!row;
}

export async function markReminderSent(
  appointmentId: string,
  reminderType: string,
  messageId?: string,
) {
  const db = getDb();
  await db.insert(appointmentReminders).values({
    appointmentId,
    reminderType,
    channel: 'whatsapp',
    status: messageId ? 'sent' : 'failed',
    messageId: messageId ?? null,
    sentAt: messageId ? new Date() : null,
  });
}

export async function processAllReminders(): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  for (const hoursBefore of [24, 2]) {
    const appts = await getAppointmentsNeedingReminders(hoursBefore);

    for (const appt of appts) {
      try {
        const alreadySent = await hasReminderBeenSent(appt.id, `h${hoursBefore}`);
        if (alreadySent) continue;

        const db = getDb();
        const [patient] = await db.select({ phone: patients.phone }).from(patients).where(and(
          eq(patients.id, appt.patientId),
          eq(patients.clinicId, appt.clinicId),
        )).limit(1);
        if (!patient?.phone) {
          whatsappLogger.warn(`No phone for patient ${appt.patientId}, skipping reminder`);
          continue;
        }

        const message = `Lembrete: você tem uma consulta agendada em ${hoursBefore}h.`;
        await createQueuedReminder({
          clinicId: appt.clinicId,
          appointmentId: appt.id,
          reminderType: `h${hoursBefore}`,
          phone: patient.phone,
          message,
        });
        processed++;
      } catch (err) {
        errors++;
        whatsappLogger.error(`Failed to send reminder for appointment ${appt.id}`, { error: err });
      }
    }
  }

  return { processed, errors };
}

// ─── Template building for obter-modelo-lembrete action ──────────────────────

export async function buildReminderTemplate(
  id: string,
  clinicId: string,
  mode: 'preview' | 'template',
) {
  const apt = await findAppointmentWithJoins(id, clinicId);
  if (!apt) return null;

  const procedureTypeId = apt.procedure?.id || '';
  const procedureTypeName = apt.procedure?.name || '';
  const config = await getEffectiveConfig(clinicId, procedureTypeId, procedureTypeName);

  const scheduledAt = new Date(apt.scheduledAt);
  const placeholders = {
    paciente_nome: apt.patient?.name || '',
    data: scheduledAt.toLocaleDateString('pt-BR'),
    horario: scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    dentista: apt.dentist?.name || '',
    procedimento: procedureTypeName,
  };
  const filledMessage = replacePlaceholders(config.message_template, placeholders);

  if (mode === 'preview') {
    return {
      preview: {
        original_template: config.message_template,
        filled_message: filledMessage,
        placeholders,
      },
    };
  }

  return {
    template: {
      procedure_type: procedureTypeName,
      hours_before: config.hours_before,
      message_template: config.message_template,
      filled_message: filledMessage,
      enabled: config.enabled,
    },
  };
}

// ─── Manual reminder trigger for gatilho-lembrete action ────────────────────

export async function triggerManualReminder(id: string, clinicId: string) {
  const result = await markReminderTriggered(id, clinicId);
  if (!result) return null;
  return { success: true };
}
