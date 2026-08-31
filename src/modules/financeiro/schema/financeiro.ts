import { sql } from 'drizzle-orm';
import { boolean, date, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { clinics, users } from '@/lib/db/schema/core';
import { appointments, patients, procedures } from '@/modules/operacional/schema';
import { leads } from '@/modules/comercial/schema';

export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
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
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  convertedFromLeadId: uuid('converted_from_lead_id').references(() => leads.id, { onDelete: 'set null' }),
  campaignId: uuid('campaign_id'),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const budgetItems = pgTable('budget_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').references(() => clinics.id, { onDelete: 'cascade' }),
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

export const budgetInstallments = pgTable('budget_installments', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').references(() => clinics.id, { onDelete: 'cascade' }),
  budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  status: text('status').default('pending'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paymentId: uuid('payment_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

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
  chargeId: uuid('charge_id'),
  status: text('status'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  chargePaymentUniq: uniqueIndex('payments_charge_id_uniq').on(t.chargeId).where(sql`${t.chargeId} IS NOT NULL`),
}));

export const paymentGateways = pgTable('payment_gateways', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  isEnabled: boolean('is_enabled').notNull().default(true),
  maskedLabel: text('masked_label'),
  encryptedConfig: jsonb('encrypted_config'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  defaultEnabledUniq: uniqueIndex('payment_gateways_default_enabled_uniq').on(t.clinicId).where(sql`${t.isDefault} = true AND ${t.isEnabled} = true`),
}));

export const paymentCharges = pgTable('payment_charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  gatewayId: uuid('gateway_id').notNull().references(() => paymentGateways.id, { onDelete: 'restrict' }),
  externalChargeId: text('external_charge_id'),
  paymentUrl: text('payment_url'),
  pixQrCode: text('pix_qr_code'),
  dueDate: date('due_date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  status: text('status').notNull().default('pending'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  clinicBudgetChargeUniq: uniqueIndex('payment_charges_clinic_budget_uniq').on(t.clinicId, t.budgetId),
}));

export const gatewayRoutingRules = pgTable('gateway_routing_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  gatewayId: uuid('gateway_id').notNull().references(() => paymentGateways.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id'),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const gatewayEvents = pgTable('gateway_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  gatewayId: uuid('gateway_id').notNull().references(() => paymentGateways.id, { onDelete: 'cascade' }),
  chargeId: uuid('charge_id').references(() => paymentCharges.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  externalEventId: text('external_event_id').notNull(),
  payload: jsonb('payload'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  providerEventUniq: uniqueIndex('gateway_events_provider_external_event_uniq').on(t.provider, t.externalEventId),
}));

export const collectionAttempts = pgTable('collection_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  chargeId: uuid('charge_id').references(() => paymentCharges.id, { onDelete: 'set null' }),
  installmentId: uuid('installment_id').references(() => budgetInstallments.id, { onDelete: 'set null' }),
  channel: text('channel').notNull(),
  stage: text('stage').notNull(),
  status: text('status').notNull().default('sent'),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
