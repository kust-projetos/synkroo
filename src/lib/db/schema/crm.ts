import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, varchar, decimal, numeric } from 'drizzle-orm/pg-core';
import { clinics, users } from './core';
import { patients, procedures } from '../../../modules/operacional/schema';
import { appointments } from './appointments';

// ══════════════════════════════════════════════
// LEADS
// ══════════════════════════════════════════════
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: text('email'),
  source: text('source').default('other'),
  campaignId: uuid('campaign_id'),
  score: integer('score').default(0),
  temperature: text('temperature').default('cold'),
  status: text('status').default('new'),
  interest: text('interest'),
  hasBudget: boolean('has_budget'),
  hasTimeline: boolean('has_timeline'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
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
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  activityType: text('activity_type').notNull(),
  description: text('description'),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow(),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ══════════════════════════════════════════════
// PIPELINE STAGES
// ══════════════════════════════════════════════
export const pipelineStages = pgTable('pipeline_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').default(0),
  color: varchar('color', { length: 7 }).default('#6b7280'),
  isDefault: boolean('is_default').default(false),
  isSystem: boolean('is_system').default(false),
  systemKey: text('system_key'),
  winProbability: integer('win_probability').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  clinicStageNameUniq: { name: 'pipelinestages_clinic_name_uniq', columns: [t.clinicId, t.name], type: 'unique' },
}));

// ══════════════════════════════════════════════
// CAMPAIGNS
// ══════════════════════════════════════════════
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  campaignType: text('campaign_type').notNull(),
  targetSegment: text('target_segment'),
  messageTemplate: text('message_template').notNull(),
  channel: text('channel').default('whatsapp'),
  status: text('status').default('draft'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  totalRecipients: integer('total_recipients').default(0),
  sentCount: integer('sent_count').default(0),
  responseCount: integer('response_count').default(0),
  conversionCount: integer('conversion_count').default(0),
  optOutCount: integer('opt_out_count').default(0),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────────────
// CAMPAIGN RECIPIENTS
// ──────────────────────────────────────────────
export const campaignRecipients = pgTable('campaign_recipients', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  status: text('status').default('pending'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  responseContent: text('response_content'),
  convertedAt: timestamp('converted_at', { withTimezone: true }),
  conversionAppointmentId: uuid('conversion_appointment_id'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  campaignPatientUniq: { name: 'campaign_recipients_campaign_patient_uniq', columns: [t.campaignId, t.patientId], type: 'unique' },
}));

// ══════════════════════════════════════════════
// FOLLOW-UPS
// ══════════════════════════════════════════════
export const followUps = pgTable('follow_ups', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  status: text('status').default('pending'),
  content: text('content'),
  response: text('response'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────────────
// FOLLOW-UP CONFIGS
// ──────────────────────────────────────────────
export const followUpConfigs = pgTable('follow_up_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  configType: text('config_type').notNull(),
  procedureId: uuid('procedure_id').references(() => procedures.id, { onDelete: 'cascade' }),
  procedureName: text('procedure_name'),
  delayHours: integer('delay_hours'),
  delayDays: integer('delay_days'),
  delayMonths: integer('delay_months'),
  messageTemplate: text('message_template').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ══════════════════════════════════════════════
// TASKS
// ══════════════════════════════════════════════
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  status: text('status').default('pending'),
  priority: text('priority').default('medium'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ══════════════════════════════════════════════
// CLINIC TAGS
// ══════════════════════════════════════════════
export const clinicTags = pgTable('clinic_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: varchar('color', { length: 7 }).default('#6b7280'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  clinicTagNameUniq: { name: 'clinictags_clinic_name_uniq', columns: [t.clinicId, t.name], type: 'unique' },
}));


// ──────────────────────────────────────────────
// CAMPAIGN SEGMENTS
// ──────────────────────────────────────────────
export const campaignSegments = pgTable('campaign_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  criteria: jsonb('criteria').notNull(),
  patientCount: integer('patient_count').default(0),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
