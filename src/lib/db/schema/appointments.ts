import { boolean, integer, jsonb, pgTable, text, time, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { clinics, dentists, patients, procedures, users } from './core';
import { appointmentStatus } from './enums';

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
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationReason: text('cancellation_reason'),
  rescheduledAt: timestamp('rescheduled_at', { withTimezone: true }),
  rescheduleReason: text('reschedule_reason'),
  confirmationSentAt: timestamp('confirmation_sent_at', { withTimezone: true }),
  reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

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
});

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
});

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
