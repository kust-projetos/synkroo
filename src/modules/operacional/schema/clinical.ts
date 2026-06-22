import { boolean, decimal, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { clinics, users } from '@/lib/db/schema/core';
import { patients } from './patients';

// ──────────────────────────────────────────────
// DENTISTS
// ──────────────────────────────────────────────
export const dentists = pgTable('dentists', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: varchar('phone', { length: 20 }),
  email: text('email'),
  cro: text('cro'),
  specialty: text('specialty'),
  croNumber: text('cro_number'),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true),
  workingHours: jsonb('working_hours').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ──────────────────────────────────────────────
// PROCEDURES
// ──────────────────────────────────────────────
export const procedures = pgTable('procedures', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  durationMinutes: integer('duration_minutes').default(30),
  price: decimal('price', { precision: 10, scale: 2 }),
  category: text('category'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ──────────────────────────────────────────────
// PROCEDURE GUIDELINES
// ──────────────────────────────────────────────
export const procedureGuidelines = pgTable('procedure_guidelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  procedureId: uuid('procedure_id').references(() => procedures.id, { onDelete: 'set null' }),
  procedureName: text('procedure_name').notNull(),
  title: text('title').notNull(),
  instructions: text('instructions').notNull(),
  emergencyContact: boolean('emergency_contact').default(false),
  recoveryTimeDays: integer('recovery_time_days'),
  restrictions: text('restrictions').array().default([]),
  warningSigns: text('warning_signs').array().default([]),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  clinicProcedureUniq: { name: 'guidelines_clinic_procedure_uniq', columns: [t.clinicId, t.procedureName], type: 'unique' },
}));

// ──────────────────────────────────────────────
// RELATIONS
// ──────────────────────────────────────────────
export const clinicsRelations = relations(clinics, ({ many }) => ({
  users: many(users),
  patients: many(patients),
  dentists: many(dentists),
  procedures: many(procedures),
}));
