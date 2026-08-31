import { boolean, pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';
import { clinics } from '@/lib/db/schema/core';

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
