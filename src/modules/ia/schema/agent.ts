import { boolean, decimal, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clinics } from '@/lib/db/schema/core';
import { appointments, patients } from '@/modules/operacional/schema';
import { conversations } from '@/modules/atendimento/schema';

export const pendingActions = pgTable('pending_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
  actionType: text('action_type').notNull(),
  riskScore: integer('risk_score').default(0).notNull(),
  riskLevel: text('risk_level').default('LOW').notNull(),
  status: text('status').default('pending').notNull(),
  snapshotBefore: jsonb('snapshot_before').default('{}'),
  snapshotAfter: jsonb('snapshot_after').default('{}'),
  undoPayload: jsonb('undo_payload').default('{}'),
  confirmationCount: integer('confirmation_count').default(0),
  maxConfirmations: integer('max_confirmations').default(1),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  undoDeadline: timestamp('undo_deadline', { withTimezone: true }).notNull(),
  undoneAt: timestamp('undone_at', { withTimezone: true }),
  reasoning: text('reasoning'),
  agentIntent: text('agent_intent'),
  confidence: decimal('confidence', { precision: 3, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const decisionLogs = pgTable('decision_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  intentClassified: text('intent_classified').notNull(),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }).notNull(),
  actionTaken: text('action_taken').notNull(),
  riskLevel: text('risk_level').default('LOW'),
  reasoning: text('reasoning').notNull(),
  escalationTriggered: boolean('escalation_triggered').default(false),
  humanOverride: boolean('human_override').default(false),
  messageSummary: text('message_summary'),
  entitiesExtracted: jsonb('entities_extracted').default('{}'),
  ragSources: jsonb('rag_sources').default('[]'),
  responseTimeMs: integer('response_time_ms'),
  tokensUsed: integer('tokens_used'),
  llmModel: text('llm_model'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const smartTriggerLog = pgTable('smart_trigger_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
  triggerType: text('trigger_type').notNull(),
  priority: integer('priority').default(5),
  messageSent: text('message_sent'),
  channel: text('channel').default('whatsapp'),
  status: text('status').default('sent'),
  patientResponded: boolean('patient_responded').default(false),
  responseAt: timestamp('response_at', { withTimezone: true }),
  patientResponse: text('patient_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const agentQueue = pgTable('agent_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromAgent: text('from_agent').notNull(),
  toAgent: text('to_agent').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').default('pending'),
  retryCount: integer('retry_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  processAfter: timestamp('process_after', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
});

export const agentDlq = pgTable('agent_dlq', {
  id: uuid('id').primaryKey().defaultRandom(),
  originalQueueId: uuid('original_queue_id'),
  fromAgent: text('from_agent'),
  toAgent: text('to_agent'),
  payload: jsonb('payload'),
  error: text('error'),
  retryCount: integer('retry_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  manualActionRequired: boolean('manual_action_required').default(true),
});

export const agentLogs = pgTable('agent_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull(),
  conversationId: uuid('conversation_id'),
  intent: text('intent'),
  confidence: decimal('confidence', { precision: 3, scale: 2 }),
  responseTimeMs: integer('response_time_ms'),
  actionTaken: text('action_taken'),
  escalation: boolean('escalation').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
