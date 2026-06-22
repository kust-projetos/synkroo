import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, numeric, date } from 'drizzle-orm/pg-core';
import { clinics, users } from './core';
import { patients, procedures } from '../../../modules/operacional/schema';
import { appointments } from './appointments';

// ══════════════════════════════════════════════
// BUDGETS
// ══════════════════════════════════════════════
export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
  title: text('title'),
  description: text('description'),
  totalValue: numeric('total_value', { precision: 10, scale: 2 }).notNull(),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).default('0'),
  discountValue: numeric('discount_value', { precision: 10, scale: 2 }).default('0'),
  finalValue: numeric('final_value', { precision: 10, scale: 2 }).notNull(),
  status: text('status').default('pending'),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  convertedAt: timestamp('converted_at', { withTimezone: true }),
  conversionAppointmentId: uuid('conversion_appointment_id'),
  notes: text('notes'),
  followUpSequence: integer('follow_up_sequence').default(0),
  nextFollowUpAt: timestamp('next_follow_up_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id),
  treatmentPlanId: uuid('treatment_plan_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────────────
// BUDGET ITEMS
// ──────────────────────────────────────────────
export const budgetItems = pgTable('budget_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  procedureId: uuid('procedure_id').references(() => procedures.id, { onDelete: 'set null' }),
  procedureName: text('procedure_name').notNull(),
  quantity: integer('quantity').default(1),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).default('0'),
  totalPrice: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────────────
// BUDGET INSTALLMENTS
// ──────────────────────────────────────────────
export const budgetInstallments = pgTable('budget_installments', {
  id: uuid('id').primaryKey().defaultRandom(),
  budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  status: text('status').default('pending'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paymentId: uuid('payment_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────────────
// PAYMENTS
// ──────────────────────────────────────────────
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  clinicId: uuid('clinic_id').references(() => clinics.id, { onDelete: 'cascade' }),
  budgetId: uuid('budget_id').references(() => budgets.id, { onDelete: 'set null' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).defaultNow(),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ══════════════════════════════════════════════
// TREATMENT PLANS
// ══════════════════════════════════════════════
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

// ──────────────────────────────────────────────
// TREATMENT PLAN ITEMS
// ──────────────────────────────────────────────
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
