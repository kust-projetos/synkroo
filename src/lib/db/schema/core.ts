import { boolean, decimal, integer, jsonb, pgTable, text, timestamp, uuid, varchar, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { userRole } from './enums';

// ──────────────────────────────────────────────
// CLINICS (Multi-tenant root)
// ──────────────────────────────────────────────
export const clinics = pgTable('clinics', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: text('email').notNull(),
  website: text('website'),
  address: jsonb('address').default('{}'),
  settings: jsonb('settings').default('{}'),
  subscriptionPlan: text('subscription_plan').default('starter'),
  subscriptionStatus: text('subscription_status').default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ──────────────────────────────────────────────
// USERS (Clinic staff — profile/domain table)
// ──────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: userRole('role').notNull().default('receptionist'),
  phone: varchar('phone', { length: 20 }),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true).notNull(),
  isMaster: boolean('is_master').default(false).notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  clinicEmailUniq: { name: 'users_clinic_email_uniq', columns: [t.clinicId, t.email], type: 'unique' },
}));

// ──────────────────────────────────────────────
// USER CREDENTIALS (password hashes — new for cutover)
// ──────────────────────────────────────────────
export const userCredentials = pgTable('user_credentials', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

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
// PATIENTS
// ──────────────────────────────────────────────
export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: text('email'),
  cpf: varchar('cpf', { length: 14 }),
  birthDate: date('birth_date'),
  gender: text('gender'),
  address: jsonb('address').default('{}'),
  notes: text('notes'),
  status: text('status').default('active'),
  tags: text('tags').array().default([]),
  riskScore: decimal('risk_score', { precision: 3, scale: 2 }).default('0.00'),
  lastVisitAt: timestamp('last_visit_at', { withTimezone: true }),
  optOutMarketing: boolean('opt_out_marketing').default(false),
  optOutReminders: boolean('opt_out_reminders').default(false),
  optOutAt: timestamp('opt_out_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  clinicPhoneUniq: { name: 'patients_clinic_phone_uniq', columns: [t.clinicId, t.phone], type: 'unique' },
}));

// ──────────────────────────────────────────────
// PATIENT OBSERVATIONS
// ──────────────────────────────────────────────
export const patientObservations = pgTable('patient_observations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────────────
// PATIENT PREFERENCES
// ──────────────────────────────────────────────
export const patientPreferences = pgTable('patient_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value').notNull(),
  category: text('category').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  patientKeyUniq: { name: 'patient_preferences_patient_key_uniq', columns: [t.patientId, t.key], type: 'unique' },
}));

// ──────────────────────────────────────────────
// PATIENT RISK SCORES (historical)
// ──────────────────────────────────────────────
export const patientRiskScores = pgTable('patient_risk_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  score: decimal('score', { precision: 3, scale: 2 }).notNull(),
  factors: jsonb('factors').default('{}'),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).defaultNow(),
});

// ──────────────────────────────────────────────
// PATIENT FEEDBACK
// ──────────────────────────────────────────────
export const patientFeedback = pgTable('patient_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  appointmentId: uuid('appointment_id'),
  feedbackType: text('feedback_type').default('post_consultation'),
  rating: integer('rating'),
  npsScore: integer('nps_score'),
  wouldRecommend: boolean('would_recommend'),
  comments: text('comments'),
  improvements: text('improvements').array().default([]),
  collectedAt: timestamp('collected_at', { withTimezone: true }).defaultNow(),
  channel: text('channel').default('whatsapp'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
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

export const usersRelations = relations(users, ({ one }) => ({
  clinic: one(clinics, { fields: [users.clinicId], references: [clinics.id] }),
  credentials: one(userCredentials, { fields: [users.id], references: [userCredentials.userId] }),
}));
