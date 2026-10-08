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

// S5-PERSIST — approval tokens persistidos (multi-instância, single-use fail-closed).
// Guarda SÓ o sha256 do token (token_hash, PK) — NUNCA o token em log ou coluna.
// Tabela efêmera (TTL default 15min); expirados removidos por lazy purge no consumo.
// clinic_id/user_id/on_behalf_of são text (sem FK): escopo por igualdade de valor,
// sem atrito de tipo com identidades server-derived; sem índice dedicado (tabela
// pequena e efêmera — purge por varredura é aceitável; ver RISKS do relatório S5).
export const approvalTokens = pgTable('approval_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  action: text('action').notNull(),
  inputHash: text('input_hash').notNull(),
  clinicId: text('clinic_id').notNull(),
  actor: text('actor').notNull(),
  userId: text('user_id'),
  onBehalfOf: text('on_behalf_of'),
  source: text('source').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
});
