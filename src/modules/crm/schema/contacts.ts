import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { clinics } from '@/lib/db/schema/core';

export const clinicTags = pgTable('clinic_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: varchar('color', { length: 7 }).default('#6b7280'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  clinicTagNameUniq: { name: 'clinictags_clinic_name_uniq', columns: [t.clinicId, t.name], type: 'unique' },
}));

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
  version: varchar('version', { length: 50 }).default('1'),
  actor: text('actor'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  contactPurposeUniq: uniqueIndex('consents_clinic_contact_purpose_uniq').on(t.clinicId, t.contactId, t.contactType, t.purpose),
}));

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
