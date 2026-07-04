// ──────────────────────────────────────────────
// Comercial bounded context — tasks schema seam
// ──────────────────────────────────────────────
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clinics, users } from '../../../lib/db/schema/core';
import { leads } from './leads';

// ══════════════════════════════════════════════
// TASKS
// ══════════════════════════════════════════════
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id')
    .notNull()
    .references(() => clinics.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  description: text('description'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  status: text('status').default('pending'),
  priority: text('priority').default('medium'),
  assignedTo: uuid('assigned_to').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
