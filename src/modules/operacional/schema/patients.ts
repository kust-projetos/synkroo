import { boolean, date, decimal, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { clinics, users } from '@/lib/db/schema/core';

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
  mergeStatus: text('merge_status').$type<'merged' | null>(),
  mergedIntoId: uuid('merged_into_id'),
  mergedAt: timestamp('merged_at', { withTimezone: true }),
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
