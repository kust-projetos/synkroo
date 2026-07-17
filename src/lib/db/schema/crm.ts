import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { clinics, users } from './core';
import { patients, procedures } from '../../../modules/operacional/schema';
import { appointments } from './appointments';

// ──────────────────────────────────────────────
// [MIGRATED] Schema moved to @/modules/comercial/schema
// Legacy re-export for backward compatibility
// ──────────────────────────────────────────────
export {
  leads,
  leadActivities,
} from '../../../modules/comercial/schema/leads';
export {
  pipelineStages,
} from '../../../modules/comercial/schema/pipeline';

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

// ──────────────────────────────────────────────
// [MIGRATED] Schema moved to @/modules/comercial/schema
// Legacy re-export for backward compatibility
// ──────────────────────────────────────────────
export {
  tasks,
} from '../../../modules/comercial/schema/tasks';

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
