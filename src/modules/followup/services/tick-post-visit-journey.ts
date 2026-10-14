/**
 * P7 Slice 1 — tick da journey pós-consulta (OBSERVE, sem envio).
 *
 * Varre instâncias não-terminais elegíveis em lote e avança no máximo UM
 * estado por instância por execução (`waiting_due` → `recommended` →
 * `waiting_feedback` → `completed` | `expired`, com saída lateral `stopped`).
 * Concorrência é cercada por UPDATE condicional (tenant + estado + revision):
 * ticks concorrentes produzem UM avanço (o perdedor casa 0 linhas e dispensa).
 * Sem leases e sem agendamento interno: restart retoma vencido (a elegibilidade
 * é só `due_at <= agora` / estado), e crash entre leitura e escrita deixa a
 * linha intacta para o próximo tick (zero órfão, zero avanço parcial).
 *
 * Stop conditions (prevalecem sobre qualquer avanço, inclusive feedback):
 * consulta excluída/ausente, consulta não-mais-concluída, opt-out do paciente.
 *
 * Fairness (P7S1-R10 HIGH): seleção por (`last_tick_at` NULLS FIRST,
 * `due_at`, `id`) e TODA linha avaliada é marcada (`last_tick_at=agora`),
 * mesmo sem transição ou com falha — rotação garantida do lote, sem
 * starvation por linhas presas.
 *
 * Outcome (só em estado terminal, determinístico):
 * `feedback_observed` (rating não-nulo, mesma consulta + mesmo tenant —
 * linha vazia legada NUNCA conta) | `expired_no_feedback` (passou a deadline
 * congelada) | `stopped`.
 *
 * Este módulo NÃO importa serviços de envio, gateways, LLM/RAG nem handlers
 * de mutação de domínio (coberto por teste estático). Derivação é pura
 * (`deriveJourneyStep`); I/O só nas seams injetáveis de `tickPostVisitJourney`
 * (testes usam mocks).
 */
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { appointments, patientFeedback, patients } from '@/modules/operacional/schema';
import {
  TERMINAL_JOURNEY_STATES,
  followupJourneyInstances,
  type JourneyState,
} from '@/modules/followup/schema/journeys';

/** Outcome da journey concluída por feedback real observado. */
export const FEEDBACK_OBSERVED_OUTCOME = 'feedback_observed' as const;

/** Outcome da journey que atingiu a deadline congelada sem feedback real. */
export const EXPIRED_NO_FEEDBACK_OUTCOME = 'expired_no_feedback' as const;

/** Outcome da journey interrompida por stop condition. */
export const STOPPED_OUTCOME = 'stopped' as const;

export type JourneyOutcome =
  | typeof FEEDBACK_OBSERVED_OUTCOME
  | typeof EXPIRED_NO_FEEDBACK_OUTCOME
  | typeof STOPPED_OUTCOME;

export type JourneyStopReason =
  | 'appointment_deleted'
  | 'appointment_no_longer_completed'
  | 'opted_out';

/** Tamanho padrão do lote varrido por execução do tick. */
export const JOURNEY_TICK_BATCH_SIZE = 100;

/** Foto mínima da instância para decidir o passo (seam injetável). */
export interface JourneyInstanceSnapshot {
  id: string;
  clinicId: string;
  appointmentId: string;
  state: string;
  revision: number;
  dueAt: Date | string;
  feedbackDeadline: Date | string;
  /** Última avaliação pelo tick (`null`/ausente = nunca examinada). */
  lastTickAt?: Date | string | null;
}

/** Sinais lidos do backend (tenant-scoped) para decidir o passo. */
export interface JourneySignals {
  /** `false` quando a consulta não existe mais ou está soft-deletada. */
  appointmentExists: boolean;
  /** Status atual da consulta (`null` quando `appointmentExists` é `false`). */
  appointmentStatus: string | null;
  /** Opt-out do paciente (marketing ou lembretes — qualquer um para). */
  optedOut: boolean;
  /** Feedback real mais recente da consulta (`null` quando não há). */
  feedback: { rating: number } | null;
}

export type JourneyStep =
  | { advance: false; reason: string }
  | { advance: true; to: JourneyState; outcome: JourneyOutcome | null; stopReason?: JourneyStopReason };

function toMs(v: Date | string): number | null {
  const t = v instanceof Date ? v.getTime() : Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/**
 * Linha de feedback REAL: mesma clínica + mesma consulta + rating não-nulo.
 * A linha vazia legada (`recordPatientFeedback` sem rating, escrita pelo
 * `processPostConsultationFollowUps` como marcador de envio) NUNCA conta —
 * `rating` nulo/não-numérico dispensa sem concluir.
 */
export function isRealFeedbackRow(
  row: { clinicId?: unknown; appointmentId?: unknown; rating?: unknown } | null | undefined,
  expected: { clinicId: string; appointmentId: string },
): row is { clinicId: string; appointmentId: string; rating: number } {
  if (!row || typeof row !== 'object') return false;
  if (row.clinicId !== expected.clinicId) return false;
  if (row.appointmentId !== expected.appointmentId) return false;
  return typeof row.rating === 'number' && Number.isFinite(row.rating);
}

/**
 * Derivação pura do próximo passo: instância + sinais + relógio injetável ⇒
 * passo. Sem I/O, sem relógio próprio, sem aleatoriedade. Determinística:
 * mesmos inputs ⇒ mesmo passo, sempre (deadline/outcome derivam dos campos
 * congelados da instância, nunca de `now()` próprio).
 */
export function deriveJourneyStep(
  instance: JourneyInstanceSnapshot,
  signals: JourneySignals,
  nowMs: number,
): JourneyStep {
  const state = instance.state;
  if ((TERMINAL_JOURNEY_STATES as readonly string[]).includes(state)) {
    return { advance: false, reason: 'terminal' };
  }

  // Stop conditions prevalecem sobre QUALQUER avanço (inclusive feedback).
  if (!signals.appointmentExists) {
    return { advance: true, to: 'stopped', outcome: STOPPED_OUTCOME, stopReason: 'appointment_deleted' };
  }
  if (signals.appointmentStatus !== 'completed') {
    return {
      advance: true,
      to: 'stopped',
      outcome: STOPPED_OUTCOME,
      stopReason: 'appointment_no_longer_completed',
    };
  }
  if (signals.optedOut) {
    return { advance: true, to: 'stopped', outcome: STOPPED_OUTCOME, stopReason: 'opted_out' };
  }

  if (state === 'waiting_due') {
    const dueMs = toMs(instance.dueAt);
    if (dueMs === null || nowMs < dueMs) {
      return { advance: false, reason: 'not_due' };
    }
    return { advance: true, to: 'recommended', outcome: null };
  }

  if (state === 'recommended') {
    return { advance: true, to: 'waiting_feedback', outcome: null };
  }

  if (state === 'waiting_feedback') {
    if (signals.feedback) {
      return { advance: true, to: 'completed', outcome: FEEDBACK_OBSERVED_OUTCOME };
    }
    const deadlineMs = toMs(instance.feedbackDeadline);
    if (deadlineMs !== null && nowMs > deadlineMs) {
      return { advance: true, to: 'expired', outcome: EXPIRED_NO_FEEDBACK_OUTCOME };
    }
    return { advance: false, reason: 'awaiting_feedback' };
  }

  return { advance: false, reason: 'unknown_state' };
}

/* ------------------------------------------------------------------ *
 * Seams injetáveis (testes usam mocks — SQL condicional só no default).
 * ------------------------------------------------------------------ */

export interface PostVisitJourneyTickDeps {
  /** Relógio injetável (default: `Date.now()`). */
  now?: () => number;
  /** Tamanho do lote (default: `JOURNEY_TICK_BATCH_SIZE`). */
  batchSize?: number;
  /** Instâncias não-terminais elegíveis (default: `followup_journey_instances`). */
  loadDueInstances?: (limit: number, now: Date) => Promise<JourneyInstanceSnapshot[]>;
  /** Sinais do backend com o tenant da instância (default: leituras tenant-scoped). */
  loadSignals?: (instance: JourneyInstanceSnapshot) => Promise<JourneySignals>;
  /**
   * UPDATE condicional (fence: tenant + id + estado esperado + revision);
   * devolve linhas afetadas (`0` = outro tick avançou antes — o perdedor
   * dispensa SEM reescrever). Default: UPDATE atômico de produção.
   */
  saveStep?: (instance: JourneyInstanceSnapshot, step: Extract<JourneyStep, { advance: true }>) => Promise<number>;
  /**
   * Marca a linha como examinada (`last_tick_at=agora`, incondicional por
   * id+tenant — sem fence, nunca bloqueia avanço). Chamada para TODA linha
   * avaliada, mesmo sem transição ou com falha; erro é engolido pelo tick
   * (best-effort, nunca altera contadores). Default: UPDATE de produção.
   */
  markExamined?: (instance: JourneyInstanceSnapshot) => Promise<void>;
}

async function defaultLoadDueInstances(
  limit: number,
  now: Date,
): Promise<JourneyInstanceSnapshot[]> {
  const rows = await getDb()
    .select({
      id: followupJourneyInstances.id,
      clinicId: followupJourneyInstances.clinicId,
      appointmentId: followupJourneyInstances.appointmentId,
      state: followupJourneyInstances.state,
      revision: followupJourneyInstances.revision,
      dueAt: followupJourneyInstances.dueAt,
      feedbackDeadline: followupJourneyInstances.feedbackDeadline,
      lastTickAt: followupJourneyInstances.lastTickAt,
    })
    .from(followupJourneyInstances)
    .where(
      and(
        inArray(followupJourneyInstances.state, ['waiting_due', 'recommended', 'waiting_feedback']),
        lte(followupJourneyInstances.dueAt, now),
      ),
    )
    // Fairness: nunca-examinadas primeiro, depois as há mais tempo sem
    // avaliação; desempate estável por (due_at, id).
    .orderBy(
      sql`${followupJourneyInstances.lastTickAt} ASC NULLS FIRST`,
      followupJourneyInstances.dueAt,
      followupJourneyInstances.id,
    )
    .limit(limit);
  return rows;
}

async function defaultLoadSignals(instance: JourneyInstanceSnapshot): Promise<JourneySignals> {
  const db = getDb();
  const [appointment] = await db
    .select({
      status: appointments.status,
      deletedAt: appointments.deletedAt,
      patientId: appointments.patientId,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.id, instance.appointmentId),
        eq(appointments.clinicId, instance.clinicId),
      ),
    )
    .limit(1);
  if (!appointment || appointment.deletedAt) {
    return { appointmentExists: false, appointmentStatus: null, optedOut: false, feedback: null };
  }
  const [patient] = await db
    .select({
      optOutMarketing: patients.optOutMarketing,
      optOutReminders: patients.optOutReminders,
    })
    .from(patients)
    .where(and(eq(patients.id, appointment.patientId), eq(patients.clinicId, instance.clinicId)))
    .limit(1);
  const feedbackRows = await db
    .select({
      clinicId: patientFeedback.clinicId,
      appointmentId: patientFeedback.appointmentId,
      rating: patientFeedback.rating,
    })
    .from(patientFeedback)
    .where(
      and(
        eq(patientFeedback.clinicId, instance.clinicId),
        eq(patientFeedback.appointmentId, instance.appointmentId),
      ),
    );
  const real = feedbackRows.find((row) =>
    isRealFeedbackRow(row, { clinicId: instance.clinicId, appointmentId: instance.appointmentId }),
  );
  return {
    appointmentExists: true,
    appointmentStatus: appointment.status,
    optedOut: Boolean(patient?.optOutMarketing || patient?.optOutReminders),
    feedback: real ? { rating: real.rating } : null,
  };
}

async function defaultSaveStep(
  instance: JourneyInstanceSnapshot,
  step: Extract<JourneyStep, { advance: true }>,
): Promise<number> {
  // UPDATE idempotente e atômico: a cerca inclui tenant + estado esperado +
  // revision — o primeiro escritor vence; replay/concorrente casa 0 linhas
  // (`affected=0` ⇒ `already_advanced`), sem sobrescrever o vencedor e sem
  // pular estados. `revision` só incrementa aqui (monótona, nunca ABA).
  const updated = await getDb()
    .update(followupJourneyInstances)
    .set({
      state: step.to,
      revision: sql`${followupJourneyInstances.revision} + 1`,
      ...(step.outcome !== null ? { outcome: step.outcome } : {}),
      // Linha que avança também foi examinada (rotação do lote).
      lastTickAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(followupJourneyInstances.id, instance.id),
        eq(followupJourneyInstances.clinicId, instance.clinicId),
        eq(followupJourneyInstances.state, instance.state),
        eq(followupJourneyInstances.revision, instance.revision),
      ),
    )
    .returning({ id: followupJourneyInstances.id });
  return updated.length;
}

/**
 * Marca a linha como examinada sem fence (id+tenant): rotação best-effort.
 * Nunca compete com `saveStep` (que cerca por estado+revision) e nunca gera
 * órfão — é só o carimbo de fairness do lote.
 */
async function defaultMarkExamined(instance: JourneyInstanceSnapshot): Promise<void> {
  await getDb()
    .update(followupJourneyInstances)
    .set({ lastTickAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(followupJourneyInstances.id, instance.id),
        eq(followupJourneyInstances.clinicId, instance.clinicId),
      ),
    );
}

export interface PostVisitJourneyTickResult {
  checked: number;
  advanced: number;
  completed: number;
  expired: number;
  stopped: number;
  skipped: number;
}

/**
 * Executa uma varredura do tick: carrega o lote elegível, deriva o passo de
 * cada instância (stop prevalece) e persiste via UPDATE condicional. Falha ao
 * carregar sinais de UMA instância não aborta o lote (conta como `skipped`).
 * TODA linha avaliada é marcada como examinada (`finally` best-effort, mesmo
 * sem transição ou com falha) para rotação fair do lote.
 */
export async function tickPostVisitJourney(
  deps: PostVisitJourneyTickDeps = {},
): Promise<PostVisitJourneyTickResult> {
  const nowMs = deps.now ? deps.now() : Date.now();
  const limit = deps.batchSize ?? JOURNEY_TICK_BATCH_SIZE;
  const loadDueInstances = deps.loadDueInstances ?? defaultLoadDueInstances;
  const loadSignals = deps.loadSignals ?? defaultLoadSignals;
  const saveStep = deps.saveStep ?? defaultSaveStep;
  const markExamined = deps.markExamined ?? defaultMarkExamined;

  const result: PostVisitJourneyTickResult = {
    checked: 0,
    advanced: 0,
    completed: 0,
    expired: 0,
    stopped: 0,
    skipped: 0,
  };

  const instances = await loadDueInstances(limit, new Date(nowMs));
  for (const instance of instances) {
    result.checked += 1;
    try {
      let signals: JourneySignals;
      try {
        signals = await loadSignals(instance);
      } catch {
        result.skipped += 1;
        continue;
      }
      const step = deriveJourneyStep(instance, signals, nowMs);
      if (!step.advance) {
        result.skipped += 1;
        continue;
      }
      let affected = 0;
      try {
        affected = await saveStep(instance, step);
      } catch {
        result.skipped += 1;
        continue;
      }
      if (affected === 0) {
        // Outro tick avançou antes (fence de revision): o perdedor dispensa.
        result.skipped += 1;
        continue;
      }
      result.advanced += 1;
      if (step.to === 'completed') result.completed += 1;
      else if (step.to === 'expired') result.expired += 1;
      else if (step.to === 'stopped') result.stopped += 1;
    } finally {
      // Fairness: marca examined em TODA linha avaliada (mesmo sem
      // transição ou com falha). Best-effort: falha aqui nunca altera
      // contadores nem aborta o lote.
      try {
        await markExamined(instance);
      } catch {
        /* best-effort */
      }
    }
  }
  return result;
}
