import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { clinics } from '@/lib/db/schema/core';

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

export const channelInstallations = pgTable('channel_installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  installationId: text('installation_id').notNull().unique(),
  secretHash: text('secret_hash').notNull(),
  allowedOrigins: text('allowed_origins').array().notNull().default([]),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

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
