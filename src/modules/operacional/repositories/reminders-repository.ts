/**
 * Reminders repository — appointment reminder configs.
 * Uses operational schema.
 */

import { getDb } from '@/lib/db/client';
import { enqueueOutbox } from '@/lib/outbox/outbox-repository';
import { OUTBOX_OPERATIONS } from '@/lib/outbox/operations';
import { appointmentReminderConfigs, appointmentReminders, procedureTypes, appointments } from '../schema/appointments';
import { patients } from '../schema/patients';
import { dentists, procedures } from '../schema/clinical';
import { clinics } from '@/lib/db/schema/core';
import { eq, and, isNull } from 'drizzle-orm';

export async function findReminderConfigById(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(appointmentReminderConfigs)
    .where(and(eq(appointmentReminderConfigs.id, id), isNull(appointmentReminderConfigs.clinicId)))
    .limit(1);
  return row ?? null;
}

export async function createReminder(params: {
  appointmentId: string;
  reminderType: string;
  channel: string;
  status: string;
  messageId?: string;
  errorMessage?: string;
  sentAt?: Date;
}): Promise<void> {
  await getDb().insert(appointmentReminders).values({
    appointmentId: params.appointmentId,
    reminderType: params.reminderType,
    channel: params.channel,
    status: params.status,
    messageId: params.messageId ?? null,
    errorMessage: params.errorMessage ?? null,
    sentAt: params.sentAt ?? null,
  } as any);
}

export async function createQueuedReminder(params: {
  clinicId: string;
  appointmentId: string;
  reminderType: string;
  phone: string;
  message: string;
}) {
  return getDb().transaction(async (tx: any) => {
    const [reminder] = await tx.insert(appointmentReminders).values({
      appointmentId: params.appointmentId,
      reminderType: params.reminderType,
      channel: 'whatsapp',
      status: 'queued',
    }).returning({ id: appointmentReminders.id });

    await enqueueOutbox(tx, {
      clinicId: params.clinicId,
      operation: OUTBOX_OPERATIONS.ATENDIMENTO_OUTBOUND_MESSAGE,
      businessKey: `appointment-reminder:${reminder.id}`,
      payload: {
        channel: 'whatsapp',
        externalId: params.phone,
        message: params.message,
        reminderId: reminder.id,
      },
    });
    return reminder;
  });
}

export async function markReminderDelivered(reminderId: string, messageId?: string) {
  const [row] = await getDb().update(appointmentReminders).set({
    status: 'sent',
    messageId: messageId ?? null,
    sentAt: new Date(),
  }).where(and(
    eq(appointmentReminders.id, reminderId),
    eq(appointmentReminders.status, 'queued'),
  )).returning({ id: appointmentReminders.id });
  return row ?? null;
}

export async function listReminderConfigs(clinicId: string) {
  const db = getDb();
  return db
    .select()
    .from(appointmentReminderConfigs)
    .where(eq(appointmentReminderConfigs.clinicId, clinicId));
}

export async function upsertReminderConfig(clinicId: string, data: {
  procedureTypeId: string;
  hoursBefore: number;
  messageTemplate: string;
  enabled: boolean;
}) {
  const db = getDb();
  const [row] = await db
    .insert(appointmentReminderConfigs)
    .values({ clinicId, ...data })
    .onConflictDoUpdate({
      target: [appointmentReminderConfigs.clinicId, appointmentReminderConfigs.procedureTypeId],
      set: { hoursBefore: data.hoursBefore, messageTemplate: data.messageTemplate, enabled: data.enabled, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function listProcedureTypes() {
  const db = getDb();
  return db.select().from(procedureTypes);
}

export async function findProcedureTypeById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(procedureTypes).where(eq(procedureTypes.id, id)).limit(1);
  return row ?? null;
}

// ─── Joined appointment fetch for reminder templates ──────────────────────────

export async function findAppointmentWithJoins(id: string, clinicId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: appointments.id,
      scheduledAt: appointments.scheduledAt,
      patient: { id: patients.id, name: patients.name, phone: patients.phone },
      dentist: { name: dentists.name },
      procedure: { id: procedures.id, name: procedures.name },
      clinic: { id: clinics.id, name: clinics.name, phone: clinics.phone },
    })
    .from(appointments)
    .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
    .leftJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(dentists, eq(dentists.id, appointments.dentistId))
    .leftJoin(procedures, eq(procedures.id, appointments.procedureId))
    .where(eq(appointments.id, id))
    .limit(1);

  const apt = rows[0];
  if (!apt || apt.clinic.id !== clinicId) return null;
  return apt;
}

// ─── Manual reminder trigger ────────────────────────────────────────────────

export async function markReminderTriggered(id: string, clinicId: string) {
  const db = getDb();
  const [appt] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
    .limit(1);
  if (!appt) return null;
  await db.update(appointments).set({ reminderSentAt: new Date() }).where(eq(appointments.id, id));
  return { id: appt.id };
}
