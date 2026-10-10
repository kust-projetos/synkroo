import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { clinics, users } from '@/lib/db/schema/core';

export const idempotencyKeys = pgTable('idempotency_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  jobType: text('job_type').notNull(),
  status: text('status').notNull().default('in_progress'),
  error: text('error'),
  fingerprint: text('fingerprint'),
  resultRef: text('result_ref'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const outboxJobs = pgTable('outbox_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  operation: text('operation').notNull(),
  businessKey: text('business_key').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  /**
   * Geração do lease do claim — fence monotônica da liquidação
   * (migration 0036). `claimOutboxJob` incrementa a geração no UPDATE atômico
   * que rouba a linha; cada liquidação (`markOutboxDelivered/Retry/Deferred/
   * DeadLetter`) casa TAMBÉM `claim_generation = <geração devolvida pelo
   * claim>` e só altera a linha quando o par casa.
   *
   * `attempts` NÃO pode servir de fence: o defer devolve uma tentativa
   * (`GREATEST(attempts - 1, 0)`), então o valor volta a repetir depois de um
   * reclaim — a condição voltaria a casar com um lease já perdido (ABA) e a
   * liquidação antiga liquidaria a execução nova. `claim_generation` é
   * monótona (nunca decrementada por nenhum marco de liquidação).
   */
  claimGeneration: integer('claim_generation').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow(),
  lastErrorCode: text('last_error_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  outboxBusinessUniq: uniqueIndex('outbox_jobs_clinic_operation_business_uniq').on(t.clinicId, t.operation, t.businessKey),
}));

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').references(() => clinics.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
