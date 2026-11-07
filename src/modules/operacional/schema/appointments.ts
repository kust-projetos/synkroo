import { boolean, index, integer, jsonb, numeric, pgTable, text, time, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clinics, users } from '@/lib/db/schema/core';
import { dentists, procedures } from './clinical';
import { patients } from './patients';
import { appointmentStatus } from '@/lib/db/schema/enums';

// ──────────────────────────────────────────────
// APPOINTMENTS
// ──────────────────────────────────────────────
export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  dentistId: uuid('dentist_id').references(() => dentists.id, { onDelete: 'set null' }),
  procedureId: uuid('procedure_id').references(() => procedures.id, { onDelete: 'set null' }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').default(30),
  status: appointmentStatus('status').notNull().default('scheduled'),
  notes: text('notes'),
  totalValue: numeric('total_value', { precision: 10, scale: 2 }).default('0'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationReason: text('cancellation_reason'),
  rescheduledAt: timestamp('rescheduled_at', { withTimezone: true }),
  rescheduleReason: text('reschedule_reason'),
  confirmationSentAt: timestamp('confirmation_sent_at', { withTimezone: true }),
  reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  clinicScheduledStatusIdx: index('appointments_clinic_scheduled_status_idx').on(t.clinicId, t.scheduledAt, t.status),
}));

// ──────────────────────────────────────────────
// APPOINTMENT CONFIRMATION REQUESTS (WhatsApp exact-confirmation P0)
//
// A pending row is the ONLY consumable confirmation intent: it binds
// tenant + appointment + patient + trusted conversation + normalized sender
// with an expiry. At most one pending row exists per (clinic, sender),
// regardless of appointment/conversation. The response path consumes only
// a sole pending bound to the inbound conversation (zero → nothing to
// confirm; more than one, or a sole pending for another conversation →
// escalate to human, no mutation).
//
// `conversationId` intentionally carries no FK: the conversations table
// lives in the atendimento seam and a hard FK here would create an
// import cycle between schema seams. Tenant binding is enforced by
// `clinicId` plus the conversation lookup at consume time.
//
// Snapshot columns (`appointmentScheduledAt` + `patientId` + `clinicTimezone`)
// record the schedule AND patient the prompt referred to: consume requires
// exact equality with the live row, and every replay formats from the
// stored snapshot — never from a later current time. No response text is
// stored (snapshot + outcome suffice; avoids an extra PII copy).
// ──────────────────────────────────────────────
export const appointmentConfirmationRequests = pgTable('appointment_confirmation_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  appointmentId: uuid('appointment_id').notNull().references(() => appointments.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull(),
  senderNormalized: text('sender_normalized').notNull(),
  // Snapshot of the schedule AND patient the prompt referred to: the
  // appointment's `scheduled_at` (persisted via INSERT ... SELECT from the
  // locked row — never via a JS Date parameter, which rounds timestamptz
  // microseconds to milliseconds) plus the appointment's `patient_id` plus
  // the resolved clinic timezone at intent time. The consume path requires
  // exact equality with the CURRENT row (timestamp via SQL column-to-column
  // comparison; patient id plus patient phone against the trusted sender)
  // before confirming, and every replay formats from THIS snapshot — never
  // from a later current time. No response text is persisted (snapshot +
  // outcome are sufficient, and avoid an extra PII copy).
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  appointmentScheduledAt: timestamp('appointment_scheduled_at', { withTimezone: true }).notNull(),
  clinicTimezone: text('clinic_timezone').notNull(),
  status: text('status').default('pending').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  consumedByProvider: text('consumed_by_provider'),
  consumedByEvent: text('consumed_by_event'),
  outcome: text('outcome'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  // At most one active pending per (clinic, sender), whatever the
  // appointment/conversation: resending the reminder never duplicates
  // consumable intent.
  pendingOnePerSender: uniqueIndex('appt_confirm_pending_sender_uniq')
    .on(t.clinicId, t.senderNormalized)
    .where(sql`${t.status} = 'pending'`),
  // Lookup da resposta: pendências do remetente na clínica.
  lookupPendingIdx: index('appt_confirm_lookup_idx').on(t.clinicId, t.senderNormalized, t.status),
  // Reconciliação por evento inbound: replay do mesmo evento encontra o
  // registro de consumo sem nunca repetir a mutação. UNIQUE parcial: cada
  // evento inbound ancora no máximo um consumo (só quando ambos os campos
  // de âncora são não-nulos; linhas pendentes/expiradas têm NULL).
  consumeEventIdx: uniqueIndex('appt_confirm_event_idx').on(t.clinicId, t.consumedByProvider, t.consumedByEvent).where(sql`${t.consumedByProvider} IS NOT NULL AND ${t.consumedByEvent} IS NOT NULL`),
}));

// ──────────────────────────────────────────────
// SCHEDULE BLOCKS (Availability)
// ──────────────────────────────────────────────
export const scheduleBlocks = pgTable('schedule_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  dentistId: uuid('dentist_id').references(() => dentists.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week'),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  isAvailable: boolean('is_available').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────────────
// APPOINTMENT REMINDERS
// ──────────────────────────────────────────────
export const appointmentReminders = pgTable('appointment_reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  appointmentId: uuid('appointment_id').notNull().references(() => appointments.id, { onDelete: 'cascade' }),
  reminderType: text('reminder_type').notNull(),
  channel: text('channel').default('whatsapp'),
  status: text('status').default('pending'),
  messageId: text('message_id'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  appointmentStatusIdx: index('appointment_reminders_appointment_status_idx').on(t.appointmentId, t.status),
}));

// ──────────────────────────────────────────────
// WAITLIST
// ──────────────────────────────────────────────
export const waitlist = pgTable('waitlist', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  dentistId: uuid('dentist_id').references(() => dentists.id, { onDelete: 'set null' }),
  preferredDate: timestamp('preferred_date', { withTimezone: true }),
  preferredTimeStart: time('preferred_time_start'),
  preferredTimeEnd: time('preferred_time_end'),
  priority: integer('priority').default(0),
  notes: text('notes'),
  status: text('status').default('waiting'),
  procedureId: uuid('procedure_id').references(() => procedures.id, { onDelete: 'set null' }),
  notifiedAt: timestamp('notified_at', { withTimezone: true }),
  scheduledAppointmentId: uuid('scheduled_appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  clinicStatusDateIdx: index('waitlist_clinic_status_preferred_date_idx').on(t.clinicId, t.status, t.preferredDate),
}));

// ──────────────────────────────────────────────
// APPOINTMENT REMINDER CONFIGS
// ──────────────────────────────────────────────
export const appointmentReminderConfigs = pgTable('appointment_reminder_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  procedureTypeId: uuid('procedure_type_id').notNull(),
  hoursBefore: integer('hours_before').notNull(),
  messageTemplate: text('message_template').notNull(),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────────────
// PROCEDURE TYPES
// ──────────────────────────────────────────────
export const procedureTypes = pgTable('procedure_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
