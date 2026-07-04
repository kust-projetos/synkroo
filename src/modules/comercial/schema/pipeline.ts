// ──────────────────────────────────────────────
// Comercial bounded context — pipeline schema seam
// ──────────────────────────────────────────────
import { boolean, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { clinics } from '../../../lib/db/schema/core';

// ══════════════════════════════════════════════
// PIPELINE STAGES
// ══════════════════════════════════════════════
export const pipelineStages = pgTable(
  'pipeline_stages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').default(0),
    color: varchar('color', { length: 7 }).default('#6b7280'),
    isDefault: boolean('is_default').default(false),
    isSystem: boolean('is_system').default(false),
    systemKey: text('system_key'),
    winProbability: integer('win_probability').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    clinicStageNameUniq: {
      name: 'pipelinestages_clinic_name_uniq',
      columns: [t.clinicId, t.name],
      type: 'unique' as const,
    },
  }),
);
