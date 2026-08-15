import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
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
  sessionVersion: integer('session_version').default(0).notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  clinicEmailUniq: uniqueIndex('users_clinic_email_uniq').on(t.clinicId, t.email),
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
// RELATIONS
// ──────────────────────────────────────────────
export const usersRelations = relations(users, ({ one }) => ({
  clinic: one(clinics, { fields: [users.clinicId], references: [clinics.id] }),
  credentials: one(userCredentials, { fields: [users.id], references: [userCredentials.userId] }),
}));
