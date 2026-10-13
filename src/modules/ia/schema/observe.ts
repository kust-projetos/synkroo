/**
 * IA — ingestão OBSERVE (P4 Slice 1A).
 *
 * Três tabelas mínimas, duráveis e tenant-scoped por construção:
 * `business_events` (envelope do fato), `goals` (conjunto lógico de
 * recomendação em fila) e `agent_runs` (execução enfileirada, ainda sem
 * efeito — OBSERVE não executa nada).
 *
 * Toda unicidade lógica inclui `clinic_id`: replay do mesmo evento
 * (`onConflictDoNothing` no hook de liquidação) produz um único conjunto
 * lógico, e nenhuma query escreve sem o predicado de tenant. Sem RAG/LLM,
 * sem handlers de mutação, sem envio externo neste slice.
 */
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { clinics } from '@/lib/db/schema/core';

export const businessEvents = pgTable('business_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  /** Id determinístico do envelope, fornecido pelo produtor (nunca gerado no consumo). */
  eventId: text('event_id').notNull(),
  /** Tipo do fato (ex.: `lead.created`). */
  type: text('type').notNull(),
  /** Versão do envelope (contrato `AI_CONTROL_ENVELOPE_VERSION`). */
  version: integer('version').notNull().default(1),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  subjectType: text('subject_type').notNull(),
  subjectId: text('subject_id').notNull(),
  payload: jsonb('payload').notNull().default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  businessEventClinicEventUniq: uniqueIndex('business_events_clinic_event_uniq').on(t.clinicId, t.eventId),
}));

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  /** Ligação lógica ao envelope: mesmo par (tenant, evento), sem FK física. */
  eventId: text('event_id').notNull(),
  status: text('status').notNull().default('queued'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  goalClinicEventUniq: uniqueIndex('goals_clinic_event_uniq').on(t.clinicId, t.eventId),
}));

export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  /** Ligação lógica ao envelope: mesmo par (tenant, evento), sem FK física. */
  eventId: text('event_id').notNull(),
  /** OBSERVE: a run nasce e permanece `queued` — nenhum executor neste slice. */
  status: text('status').notNull().default('queued'),
  /** Modo de observação fixo; executores futuros decidem por gate próprio. */
  mode: text('mode').notNull().default('observe'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  agentRunClinicEventUniq: uniqueIndex('agent_runs_clinic_event_uniq').on(t.clinicId, t.eventId),
}));
