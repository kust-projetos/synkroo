import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { clinics } from '@/lib/db/schema/core';
import { appointments } from '@/modules/operacional/schema/appointments';
import { POST_VISIT_JOURNEY_KIND } from '@/lib/outbox/operations';

/**
 * P7 Slice 1 — journey pós-consulta em OBSERVE.
 *
 * Uma instância por (clínica, consulta, kind): replay do mesmo evento
 * materializa uma única linha (`onConflictDoNothing` na UNIQUE).
 *
 * Máquina de estados (S1, sem envio, sem branches):
 * `waiting_due` → `recommended` → `waiting_feedback` → `completed` | `expired`,
 * com saída lateral `stopped` (stop conditions) a partir de qualquer estado
 * não-terminal. O tick avança no máximo UM estado por instância por execução;
 * concorrência é cercada por UPDATE condicional (tenant + estado + revision).
 */

/** Versão congelada da definição da journey deste slice. */
export const POST_VISIT_JOURNEY_DEFINITION_VERSION = 'p7-s1-v1' as const;

export const JOURNEY_STATES = [
  'waiting_due',
  'recommended',
  'waiting_feedback',
  'completed',
  'expired',
  'stopped',
] as const;

export type JourneyState = (typeof JOURNEY_STATES)[number];

export const TERMINAL_JOURNEY_STATES: readonly JourneyState[] = [
  'completed',
  'expired',
  'stopped',
] as const;

export function isJourneyState(value: unknown): value is JourneyState {
  return (
    typeof value === 'string' &&
    (JOURNEY_STATES as readonly string[]).includes(value)
  );
}

export const followupJourneyInstances = pgTable(
  'followup_journey_instances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id, { onDelete: 'cascade' }),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    journeyKind: text('journey_kind').notNull().default(POST_VISIT_JOURNEY_KIND),
    /** Id determinístico do evento de origem (produtor, nunca gerado no consumo). */
    sourceEventId: text('source_event_id').notNull(),
    definitionVersion: text('definition_version')
      .notNull()
      .default(POST_VISIT_JOURNEY_DEFINITION_VERSION),
    state: text('state').notNull().default('waiting_due'),
    /** Fence monotônica do tick: todo avanço casa `revision` e incrementa. */
    revision: integer('revision').notNull().default(0),
    /** Congelado na materialização: `occurredAt + 2h` (nunca recalculado). */
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    /** Congelado na materialização: `occurredAt + 48h` (nunca recalculado). */
    feedbackDeadline: timestamp('feedback_deadline', { withTimezone: true }).notNull(),
    /**
     * P7S1-R10 HIGH (fairness): última vez que o tick avaliou a linha
     * (mesmo sem transição). `NULL` = nunca examinada. O tick seleciona por
     * (`last_tick_at` NULLS FIRST, `due_at`, `id`) para rotação garantida do
     * lote: linhas presas (ex. falha persistente de sinais) não bloqueiam as
     * demais para sempre.
     */
    lastTickAt: timestamp('last_tick_at', { withTimezone: true }),
    /** Referência à run P4 OBSERVE (`agent_runs.event_id`, mesmo tenant). */
    runEventId: text('run_event_id'),
    /** `feedback_observed` | `expired_no_feedback` | `stopped` (só em terminal). */
    outcome: text('outcome'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    journeyClinicAppointmentKindUniq: uniqueIndex(
      'followup_journey_clinic_appt_kind_uniq',
    ).on(t.clinicId, t.appointmentId, t.journeyKind),
    journeyDueStateIdx: index('followup_journey_due_state_idx').on(
      t.clinicId,
      t.state,
      t.dueAt,
    ),
    journeyTickFairnessIdx: index('followup_journey_tick_fairness_idx').on(
      t.state,
      t.lastTickAt,
      t.dueAt,
    ),
  }),
);

export type FollowupJourneyInstance = typeof followupJourneyInstances.$inferSelect;
