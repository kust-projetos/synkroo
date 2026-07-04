// ──────────────────────────────────────────────
// Comercial bounded context — leads schema seam
// ──────────────────────────────────────────────
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { clinics, users } from '../../../lib/db/schema/core';
import { patients } from '../../operacional/schema';

// ══════════════════════════════════════════════
// LEADS
// ══════════════════════════════════════════════
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id')
    .notNull()
    .references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').references(() => patients.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  phoneNormalized: varchar('phone_normalized', { length: 32 }),
  email: text('email'),
  source: text('source').default('other'),
  campaignId: uuid('campaign_id'),
  score: integer('score').default(0),
  temperature: text('temperature').default('cold'),
  status: text('status').default('new'),
  interest: text('interest'),
  hasBudget: boolean('has_budget'),
  hasTimeline: boolean('has_timeline'),
  assignedTo: uuid('assigned_to').references(() => users.id, {
    onDelete: 'set null',
  }),
  lastContactAt: timestamp('last_contact_at', { withTimezone: true }),
  nextFollowupAt: timestamp('next_followup_at', { withTimezone: true }),
  contactCount: integer('contact_count').default(0),
  convertedAt: timestamp('converted_at', { withTimezone: true }),
  convertedAppointmentId: uuid('converted_appointment_id'),
  lostReason: text('lost_reason'),
  lostAt: timestamp('lost_at', { withTimezone: true }),
  notes: text('notes'),
  stageId: uuid('stage_id'),
  sourceType: text('source_type'),
  dealValue: numeric('deal_value', { precision: 12, scale: 2 }).default('0'),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────────────
// LEAD ACTIVITIES
// ──────────────────────────────────────────────
export const leadActivities = pgTable('lead_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id')
    .notNull()
    .references(() => leads.id, { onDelete: 'cascade' }),
  activityType: text('activity_type').notNull(),
  description: text('description'),
  performedBy: uuid('performed_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow(),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
