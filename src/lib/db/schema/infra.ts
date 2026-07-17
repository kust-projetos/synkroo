import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { clinics, users } from './core';
import { patients } from '../../../modules/operacional/schema';
import { vector } from 'drizzle-orm/pg-core';

// ══════════════════════════════════════════════
// KNOWLEDGE BASE (with pgvector embedding)
// ══════════════════════════════════════════════
export const knowledgeBase = pgTable('knowledge_base', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  keywords: text('keywords').array().default([]),
  embedding: vector('embedding', { dimensions: 1536 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ══════════════════════════════════════════════
// WHATSAPP INSTANCES
// ══════════════════════════════════════════════
export const whatsappInstances = pgTable('whatsapp_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  phoneNumberId: varchar('phone_number_id', { length: 100 }).notNull(),
  businessAccountId: text('business_account_id'),
  displayName: text('display_name'),
  qualityRating: text('quality_rating'),
  status: text('status').default('pending'),
  lastConnectedAt: timestamp('last_connected_at', { withTimezone: true }),
  evolutionInstanceName: text('evolution_instance_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────────────
// MESSAGE TEMPLATES
// ──────────────────────────────────────────────
export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  language: text('language').default('pt_BR'),
  header: text('header'),
  body: text('body').notNull(),
  footer: text('footer'),
  buttons: jsonb('buttons').default('[]'),
  variables: jsonb('variables').default('[]'),
  metaTemplateId: text('meta_template_id'),
  status: text('status').default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ══════════════════════════════════════════════
// CONSENTS (LGPD)
// ══════════════════════════════════════════════
export const consents = pgTable('consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull(),
  contactType: varchar('contact_type', { length: 10 }).notNull(),
  purpose: varchar('purpose', { length: 50 }).notNull(),
  granted: boolean('granted').default(true).notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  channel: varchar('channel', { length: 20 }).default('web'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  contactPurposeUniq: { name: 'consents_contact_purpose_uniq', columns: [t.contactId, t.contactType, t.purpose], type: 'unique' },
}));

// ══════════════════════════════════════════════
// CUSTOM FIELD DEFINITIONS
// ══════════════════════════════════════════════
export const customFieldDefinitions = pgTable('custom_field_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  fieldType: varchar('field_type', { length: 20 }).notNull(),
  options: jsonb('options').default('[]'),
  required: boolean('required').default(false),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  clinicDefNameUniq: { name: 'customfields_clinic_name_uniq', columns: [t.clinicId, t.name], type: 'unique' },
}));

// ──────────────────────────────────────────────
// CUSTOM FIELD VALUES (EAV)
// ──────────────────────────────────────────────
export const customFieldValues = pgTable('custom_field_values', {
  id: uuid('id').primaryKey().defaultRandom(),
  definitionId: uuid('definition_id').notNull().references(() => customFieldDefinitions.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull(),
  contactType: varchar('contact_type', { length: 10 }).notNull(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  valueText: text('value_text'),
  valueNumber: integer('value_number'),
  valueDate: timestamp('value_date', { withTimezone: true }),
  valueBoolean: boolean('value_boolean'),
  valueJson: jsonb('value_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  defContactUniq: { name: 'customfields_def_contact_uniq', columns: [t.definitionId, t.contactId, t.contactType], type: 'unique' },
}));

// ══════════════════════════════════════════════
// AUDIT LOGS
// ══════════════════════════════════════════════
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').references(() => clinics.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
