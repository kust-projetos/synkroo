import { pgTable, uuid, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { clinics } from './core';

export const actionLogs = pgTable('action_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').references(() => clinics.id, { onDelete: 'set null' }), // null em pré-auth
  principalType: text('principal_type'),     // 'user' | 'agent_delegated' | 'system' | null
  actor: text('actor').notNull(),            // userId | 'agente' | 'agente (sistema)' | 'unknown'
  onBehalfOf: uuid('on_behalf_of'),          // userId delegante (agent_delegated)
  actionName: text('action_name').notNull(),
  module: text('module').notNull(),
  inputRedacted: jsonb('input_redacted').default('{}'),
  result: text('result').notNull(),          // 'ok' | 'error'
  errorCode: text('error_code'),
  // S5 — evolução ActionAttempt (expand-only, tudo nullable; nunca alterar/remover coluna existente):
  durationMs: integer('duration_ms'),
  policyVersion: text('policy_version'),
  decision: text('decision'),                // 'allow' | 'deny' | 'approval_required'
  approvalId: text('approval_id'),           // fingerprint do approval token (16 hex), nunca o token
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
