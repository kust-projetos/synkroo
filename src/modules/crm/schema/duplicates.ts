import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { clinics, users } from '@/lib/db/schema/core';

export type DuplicateOwnerType = 'patient' | 'lead';
export type DuplicateStatus =
  | 'pending'
  | 'approved'
  | 'executing'
  | 'merged'
  | 'failed'
  | 'dismissed';
export type DuplicateConfidence = 'medium' | 'high';
export type DuplicateEvidence = Record<string, unknown>;

export const crmDuplicateSuggestions = pgTable(
  'crm_duplicate_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id, { onDelete: 'cascade' }),
    ownerType: text('owner_type').$type<DuplicateOwnerType>().notNull(),
    leftId: uuid('left_id').notNull(),
    rightId: uuid('right_id').notNull(),
    status: text('status').$type<DuplicateStatus>().notNull().default('pending'),
    confidence: text('confidence').$type<DuplicateConfidence>().notNull(),
    duplicateScore: integer('duplicate_score').notNull(),
    winnerSuggestedId: uuid('winner_suggested_id'),
    winnerConfirmedId: uuid('winner_confirmed_id'),
    signals: jsonb('signals').$type<DuplicateEvidence>().notNull(),
    leftSnapshot: jsonb('left_snapshot').$type<DuplicateEvidence>().notNull(),
    rightSnapshot: jsonb('right_snapshot').$type<DuplicateEvidence>().notNull(),
    dismissReason: text('dismiss_reason'),
    mergeOperationKey: text('merge_operation_key'),
    failureReason: text('failure_reason'),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    executedBy: uuid('executed_by').references(() => users.id, { onDelete: 'set null' }),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'crm_duplicate_suggestions_owner_type_check',
      sql`${table.ownerType} IN ('patient', 'lead')`,
    ),
    check(
      'crm_duplicate_suggestions_status_check',
      sql`${table.status} IN ('pending', 'approved', 'executing', 'merged', 'failed', 'dismissed')`,
    ),
    check(
      'crm_duplicate_suggestions_confidence_check',
      sql`${table.confidence} IN ('medium', 'high')`,
    ),
    check(
      'crm_duplicate_suggestions_score_check',
      sql`${table.duplicateScore} BETWEEN 0 AND 100`,
    ),
    check(
      'crm_duplicate_suggestions_left_right_check',
      sql`${table.leftId} <> ${table.rightId}`,
    ),
    check(
      'crm_duplicate_suggestions_winner_check',
      sql`${table.status} NOT IN ('executing', 'merged') OR ${table.winnerConfirmedId} IS NOT NULL`,
    ),
    uniqueIndex('crm_duplicate_suggestions_pair_canonical_uniq').on(
      table.clinicId,
      table.ownerType,
      sql`LEAST(${table.leftId}, ${table.rightId})`,
      sql`GREATEST(${table.leftId}, ${table.rightId})`,
    ),
    uniqueIndex('crm_duplicate_suggestions_merge_operation_key_uniq')
      .on(table.mergeOperationKey)
      .where(sql`${table.mergeOperationKey} IS NOT NULL`),
    index('crm_duplicate_suggestions_queue_idx').on(
      table.clinicId,
      table.status,
      table.ownerType,
      table.detectedAt,
    ),
    index('crm_duplicate_suggestions_left_lookup_idx').on(
      table.clinicId,
      table.ownerType,
      table.leftId,
    ),
    index('crm_duplicate_suggestions_right_lookup_idx').on(
      table.clinicId,
      table.ownerType,
      table.rightId,
    ),
  ],
);
