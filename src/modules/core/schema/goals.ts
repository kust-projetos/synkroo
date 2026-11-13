import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clinics } from '@/lib/db/schema/core';

/**
 * Goal — entidade de Control Plane (ADR-BASE-18 / vNext E5-A).
 *
 * Representa um objetivo de negócio rastreável, tenant-scoped, correlacionável
 * com AgentRun e BusinessEvent. Feature flag OFF por padrão: nenhum writer
 * invoca LLM nem executa workflow automaticamente nesta tranche.
 *
 * Status permitidos: 'open' | 'in_progress' | 'done' | 'cancelled'.
 */
export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('open'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
