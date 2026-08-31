import { integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clinics, users } from '@/lib/db/schema/core';
import { appointments } from './appointments';
import { patients } from './patients';
import { procedures } from './clinical';

export const appointmentStatusLog = pgTable('appointment_status_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  appointmentId: uuid('appointment_id').notNull().references(() => appointments.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  changedBy: text('changed_by').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const treatmentPlans = pgTable('treatment_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  totalSessions: integer('total_sessions').default(1),
  completedSessions: integer('completed_sessions').default(0),
  status: text('status').default('in_progress'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  expectedCompletionAt: timestamp('expected_completion_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  lastSessionAt: timestamp('last_session_at', { withTimezone: true }),
  nextSessionDueAt: timestamp('next_session_due_at', { withTimezone: true }),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const treatmentPlanItems = pgTable('treatment_plan_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  treatmentPlanId: uuid('treatment_plan_id').notNull().references(() => treatmentPlans.id, { onDelete: 'cascade' }),
  procedureId: uuid('procedure_id').references(() => procedures.id, { onDelete: 'set null' }),
  procedureName: text('procedure_name').notNull(),
  sessionNumber: integer('session_number').notNull(),
  appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
  status: text('status').default('pending'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  planSessionUniq: { name: 'treatment_plan_items_plan_session_uniq', columns: [t.treatmentPlanId, t.sessionNumber], type: 'unique' },
}));
