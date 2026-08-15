import { boolean, index, integer, jsonb, numeric, pgTable, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';
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
