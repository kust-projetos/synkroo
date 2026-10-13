/**
 * P4 Slice 4 — Outcome telemetry para 1 outcome de negócio do piloto.
 *
 * Outcome suportado: `conversation_resolved` (spec vNext §10, um dos 15
 * outcomes iniciais). Escolha documentada: o executor do Slice 3 entrega
 * SOMENTE leitura verificável (`operacional.obterPaciente`, sem efeito
 * externo); dos outcomes da spec, `conversation_resolved` é o único
 * atribuível a essa entrega + um fato observável (`conversation.resolved`)
 * SEM ler tabelas de negócio fora do seam (`business_events`, já
 * tenant-scoped). `lead_*`, `appointment_*`, `budget_*`, `payment_*` e
 * `revenue_*` exigiriam joins com CRM/financeiro — fora do escopo deste
 * slice (escalar com análise se o piloto pedir outro outcome).
 *
 * Recomendação → entrega → conversão são estados DISTINTOS, sem
 * causalidade inventada:
 * - recomendação: `policy_decision` AUTO gravada (S2, só lida aqui);
 * - entrega: `execution_receipt` + `execution_outcome=business_success`
 *   (S3, só lidos aqui — este módulo NUNCA executa);
 * - conversão: fato `conversation.resolved` em `business_events`, mesmo
 *   tenant, com `occurred_at` dentro da janela de atribuição. Sem o fato,
 *   NÃO há atribuição (janela expirada ou sem evidência ⇒ `not_attributed`).
 *
 * Janela de atribuição: 48h a partir da entrega (`deliveredAt`, o
 * `updatedAt` da run após o receipt; injetável nos testes). Hipótese do
 * piloto para tempo de resolução de conversa — constante
 * `OUTCOME_WINDOW_MS`, sem auto-tuning.
 *
 * Evidência exigida: o fato de negócio (identidade: `event_id`, `type`,
 * `occurred_at`, `subject_*` — nunca conteúdo). Custo: NUNCA medido neste
 * slice ⇒ a chave `cost` é sempre omitida (nunca inventada). Duração:
 * derivada do `receipt.duration_ms` quando número finito ≥ 0, senão omitida.
 *
 * `suspended`/`failed` do executor ⇒ `failed_workflow` (status `failed`),
 * SEM atribuição de conversão (`attributed_to: null`, sem janela).
 *
 * Idempotência: chave determinística
 * `outcome:{clinicId}:{eventId}:{type}` gravada em
 * `result.outcome_telemetry`. Só outcomes FINAIS persistem (`attributed`,
 * `failed`, ou `not_attributed` com janela expirada — estáveis);
 * transitórios (`not_delivered`, `no_evidence` com janela aberta,
 * `no_delivery_time`) derivam SEM escrever. Re-derivação idêntica detectada
 * por deep-equal NÃO reescreve (nem tenta o UPDATE); o UPDATE de produção é
 * condicional (`outcome_telemetry IS NULL` — primeira escrita vence, replay
 * casa 0 linhas).
 *
 * Persistência: reuso da coluna `result` jsonb — NENHUMA migration neste
 * slice. Justificativa: 1 outcome, volume do piloto, leitura sempre pelo
 * par (tenant, evento) já indexado (`agent_runs_clinic_event_uniq`); tabela
 * ou índice dedicado só quando o piloto escalar para N outcomes ou leitura
 * agregada por tipo.
 *
 * Este módulo NÃO importa LLM, RAG, execução de Actions, envio externo nem
 * handlers de mutação de domínio (coberto por teste estático). Derivação é
 * pura (`deriveOutcome`: run + eventos + relógio injetável); I/O só nas
 * seams injetáveis de `recordOutcome` (testes usam mocks).
 */
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { agentRuns, businessEvents } from '@/modules/ia/schema/observe';

/** Versão da política de outcome deste slice — gravada em cada outcome. */
export const AI_CONTROL_OUTCOME_POLICY_VERSION = 'p4-s4-outcome-v1' as const;

/** Chave jsonb sob a qual o outcome vive dentro de `agent_runs.result`. */
export const OUTCOME_TELEMETRY_RESULT_KEY = 'outcome_telemetry' as const;

/** Único outcome de negócio suportado neste slice. */
export const SUPPORTED_OUTCOME_TYPE = 'conversation_resolved' as const;

/** Tipo registrado quando o executor suspende/falha (sem conversão). */
export const FAILED_WORKFLOW_TYPE = 'failed_workflow' as const;

export type SupportedOutcomeType =
  | typeof SUPPORTED_OUTCOME_TYPE
  | typeof FAILED_WORKFLOW_TYPE;

/** Tipo do fato de negócio que evidencia a conversão. */
export const OUTCOME_EVIDENCE_EVENT_TYPE = 'conversation.resolved' as const;

/**
 * Janela de atribuição após a entrega: 48h (hipótese do piloto, sem
 * auto-tuning). Fato fora da janela NÃO atribui (evidência tardia pode ser
 * correlação, não conversão da entrega).
 */
export const OUTCOME_WINDOW_MS = 48 * 60 * 60 * 1000;

export type OutcomeAttributionStatus = 'attributed' | 'not_attributed' | 'failed';

export interface OutcomeWindow {
  start: string;
  end: string;
}

export interface DerivedOutcome {
  type: SupportedOutcomeType;
  status: OutcomeAttributionStatus;
  /** `event_id` do fato de negócio, ou `null` quando não atribuído. */
  attributed_to: string | null;
  /**
   * Janela de atribuição; `null` quando não há âncora de entrega
   * (sem entrega bem-sucedida não há janela honesta a declarar).
   */
  window: OutcomeWindow | null;
  /** Evidência sanitizada: códigos/identidades, nunca PII ou conteúdo. */
  evidence: Record<string, unknown>;
  /** Derivada do receipt; omitida quando o receipt não a mede. */
  duration_ms?: number;
  /** Chave determinística de idempotência (replay ⇒ mesma chave ⇒ skip). */
  idempotency_key: string;
  /** Versão da política de outcome (este slice). */
  outcome_policy_version: typeof AI_CONTROL_OUTCOME_POLICY_VERSION;
  // NOTA: `cost` é deliberadamente ausente — custo nunca medido neste
  // slice, e valor inventado aqui contaminaria `revenue_influenced` futuro.
}

export interface OutcomeRunSnapshot {
  clinicId: string;
  eventId: string;
  status: string;
  result: unknown;
  /**
   * Instante da entrega (persistência do receipt) em ISO — ancora a janela.
   * Em produção, o `updatedAt` da run; `null`/ausente ⇒ sem âncora.
   */
  deliveredAt?: string | null;
}

export interface OutcomeBusinessEvent {
  clinicId: string;
  eventId: string;
  type: string;
  occurredAt: string;
  subjectType?: string;
  subjectId?: string;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function parseTimeMs(v: unknown): number | null {
  if (typeof v !== 'string' || v.length === 0) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/** Chave determinística de idempotência — pura, mesma tupla ⇒ mesma chave. */
export function buildOutcomeIdempotencyKey(
  clinicId: string,
  eventId: string,
  type: SupportedOutcomeType,
): string {
  return `outcome:${clinicId}:${eventId}:${type}`;
}

function readExecOutcomeStatus(result: unknown): string | null {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) return null;
  const raw = (result as Record<string, unknown>).execution_outcome;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const status = (raw as Record<string, unknown>).status;
  return typeof status === 'string' ? status : null;
}

function readReceipt(result: unknown): Record<string, unknown> | null {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) return null;
  const raw = (result as Record<string, unknown>).execution_receipt;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/** Duração honesta: só quando o receipt mede (número finito ≥ 0). */
function readReceiptDurationMs(result: unknown): number | undefined {
  const receipt = readReceipt(result);
  const d = receipt?.duration_ms;
  return typeof d === 'number' && Number.isFinite(d) && d >= 0 ? d : undefined;
}

function readExecReason(result: unknown): string | null {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) return null;
  const raw = (result as Record<string, unknown>).execution_outcome;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const evidence = (raw as Record<string, unknown>).evidence;
  if (typeof evidence !== 'object' || evidence === null || Array.isArray(evidence)) return null;
  const reason = (evidence as Record<string, unknown>).reason;
  return typeof reason === 'string' ? reason : null;
}

/**
 * Derivação pura do outcome: run (com receipt/outcome do executor) +
 * eventos de negócio + relógio injetável ⇒ outcome. Sem I/O, sem relógio
 * próprio, sem aleatoriedade. Determinística.
 */
export function deriveOutcome(
  run: OutcomeRunSnapshot | null | undefined,
  events: OutcomeBusinessEvent[] | null | undefined,
  nowMs: number,
): DerivedOutcome {
  const clinicId =
    run && typeof run === 'object' && isNonEmptyString(run.clinicId) ? run.clinicId : 'unknown';
  const eventId =
    run && typeof run === 'object' && isNonEmptyString(run.eventId) ? run.eventId : 'unknown';
  const result = run && typeof run === 'object' ? run.result : null;

  if (!run || typeof run !== 'object' || clinicId === 'unknown' || eventId === 'unknown') {
    return {
      type: SUPPORTED_OUTCOME_TYPE,
      status: 'not_attributed',
      attributed_to: null,
      window: null,
      evidence: { reason: 'invalid_run' },
      idempotency_key: buildOutcomeIdempotencyKey(clinicId, eventId, SUPPORTED_OUTCOME_TYPE),
      outcome_policy_version: AI_CONTROL_OUTCOME_POLICY_VERSION,
    };
  }

  const durationMs = readReceiptDurationMs(result);
  const withDuration = (base: Omit<DerivedOutcome, 'duration_ms'>): DerivedOutcome =>
    durationMs === undefined ? base : { ...base, duration_ms: durationMs };

  // suspended/failed do executor ⇒ failed_workflow, SEM atribuição de
  // conversão e SEM janela (não há entrega bem-sucedida a ancorar).
  const execStatus = readExecOutcomeStatus(result);
  if (execStatus === 'suspended' || execStatus === 'failed') {
    const receipt = readReceipt(result);
    const attemptId = receipt?.attempt_id;
    return withDuration({
      type: FAILED_WORKFLOW_TYPE,
      status: 'failed',
      attributed_to: null,
      window: null,
      evidence: {
        reason: 'exec_not_successful',
        exec_status: execStatus,
        exec_reason: readExecReason(result) ?? 'unknown',
        ...(typeof attemptId === 'string' ? { attempt_id: attemptId } : {}),
      },
      idempotency_key: buildOutcomeIdempotencyKey(clinicId, eventId, FAILED_WORKFLOW_TYPE),
      outcome_policy_version: AI_CONTROL_OUTCOME_POLICY_VERSION,
    });
  }

  // Sem entrega bem-sucedida, não há conversão a atribuir — e sem âncora,
  // não há janela honesta a declarar.
  if (execStatus !== 'business_success') {
    return withDuration({
      type: SUPPORTED_OUTCOME_TYPE,
      status: 'not_attributed',
      attributed_to: null,
      window: null,
      evidence: { reason: 'not_delivered', exec_status: execStatus ?? 'missing' },
      idempotency_key: buildOutcomeIdempotencyKey(clinicId, eventId, SUPPORTED_OUTCOME_TYPE),
      outcome_policy_version: AI_CONTROL_OUTCOME_POLICY_VERSION,
    });
  }

  const deliveredMs = parseTimeMs(run.deliveredAt);
  if (deliveredMs === null) {
    return withDuration({
      type: SUPPORTED_OUTCOME_TYPE,
      status: 'not_attributed',
      attributed_to: null,
      window: null,
      evidence: { reason: 'no_delivery_time' },
      idempotency_key: buildOutcomeIdempotencyKey(clinicId, eventId, SUPPORTED_OUTCOME_TYPE),
      outcome_policy_version: AI_CONTROL_OUTCOME_POLICY_VERSION,
    });
  }

  const window: OutcomeWindow = {
    start: new Date(deliveredMs).toISOString(),
    end: new Date(deliveredMs + OUTCOME_WINDOW_MS).toISOString(),
  };
  const endMs = deliveredMs + OUTCOME_WINDOW_MS;

  const list = Array.isArray(events) ? events : [];
  let matchingTypeCount = 0;
  const candidates: { eventId: string; occurredMs: number; occurredAt: string; subjectType?: string; subjectId?: string }[] = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    // Tenant primeiro: fato de outra clínica NUNCA evidencia conversão aqui.
    if (e.clinicId !== clinicId) continue;
    if (e.type !== OUTCOME_EVIDENCE_EVENT_TYPE) continue;
    if (!isNonEmptyString(e.eventId)) continue;
    matchingTypeCount += 1;
    const occ = parseTimeMs(e.occurredAt);
    if (occ === null) continue;
    if (occ < deliveredMs || occ > endMs) continue;
    candidates.push({
      eventId: e.eventId,
      occurredMs: occ,
      occurredAt: new Date(occ).toISOString(),
      ...(isNonEmptyString(e.subjectType) ? { subjectType: e.subjectType } : {}),
      ...(isNonEmptyString(e.subjectId) ? { subjectId: e.subjectId } : {}),
    });
  }
  // Primeiro fato dentro da janela (atribuição conservadora: o mais próximo
  // da entrega; fatos posteriores não re-atribuem — ver persistência).
  candidates.sort((a, b) => a.occurredMs - b.occurredMs || (a.eventId < b.eventId ? -1 : 1));
  const first = candidates[0];

  if (first) {
    return withDuration({
      type: SUPPORTED_OUTCOME_TYPE,
      status: 'attributed',
      attributed_to: first.eventId,
      window,
      evidence: {
        reason: 'business_event_in_window',
        business_event_id: first.eventId,
        business_event_type: OUTCOME_EVIDENCE_EVENT_TYPE,
        occurred_at: first.occurredAt,
        ...(first.subjectType ? { subject_type: first.subjectType } : {}),
        ...(first.subjectId ? { subject_id: first.subjectId } : {}),
      },
      idempotency_key: buildOutcomeIdempotencyKey(clinicId, eventId, SUPPORTED_OUTCOME_TYPE),
      outcome_policy_version: AI_CONTROL_OUTCOME_POLICY_VERSION,
    });
  }

  // Sem fato dentro da janela: expirada (relógio passou do fim) ou ainda
  // aguardando evidência (janela aberta — transitório, NÃO persiste).
  const expired = nowMs > endMs;
  return withDuration({
    type: SUPPORTED_OUTCOME_TYPE,
    status: 'not_attributed',
    attributed_to: null,
    window,
    evidence: {
      reason: expired ? 'window_expired' : 'no_evidence',
      window_start: window.start,
      window_end: window.end,
      matching_type_count: matchingTypeCount,
    },
    idempotency_key: buildOutcomeIdempotencyKey(clinicId, eventId, SUPPORTED_OUTCOME_TYPE),
    outcome_policy_version: AI_CONTROL_OUTCOME_POLICY_VERSION,
  });
}

/** Outcome gravável é imutável: atribuído, falho, ou janela fechada. */
export function isFinalOutcome(outcome: DerivedOutcome): boolean {
  if (outcome.status === 'attributed' || outcome.status === 'failed') return true;
  return (outcome.evidence as Record<string, unknown>).reason === 'window_expired';
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => isDeepEqual(v, (b as unknown[])[i]));
  }
  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(b, k) &&
      isDeepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
  );
}

export function getOutcomeTelemetry(result: unknown): DerivedOutcome | null {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) return null;
  const raw = (result as Record<string, unknown>)[OUTCOME_TELEMETRY_RESULT_KEY];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  return raw as DerivedOutcome;
}

/**
 * Guarda pura da persistência: re-derivação idêntica NÃO reescreve;
 * outcome já gravado e divergente NÃO é sobrescrito (primeira escrita
 * vence — divergência exige reconciliação manual); transitório NÃO persiste.
 */
export function shouldPersistOutcome(
  existingResult: unknown,
  derived: DerivedOutcome,
): { persist: boolean; reason: string } {
  const existing = getOutcomeTelemetry(existingResult);
  if (existing && isDeepEqual(existing, derived)) {
    return { persist: false, reason: 'already_recorded' };
  }
  if (existing) {
    return { persist: false, reason: 'outcome_exists' };
  }
  if (!isFinalOutcome(derived)) {
    return { persist: false, reason: 'not_final' };
  }
  return { persist: true, reason: 'ok' };
}

/* ------------------------------------------------------------------ *
 * Seams injetáveis (testes usam mocks — leitura de `business_events`
 * tenant-scoped e UPDATE condicional só no default de produção).
 * ------------------------------------------------------------------ */

export interface AiControlOutcomeDeps {
  /** Carga da run (default: `agent_runs` com predicado de tenant). */
  loadRun?: (clinicId: string, eventId: string) => Promise<OutcomeRunSnapshot | null>;
  /** Fatos de negócio do tenant (default: `business_events` por clínica). */
  loadBusinessEvents?: (clinicId: string) => Promise<OutcomeBusinessEvent[]>;
  /** UPDATE condicional; devolve linhas afetadas (0 = replay venceu antes). */
  saveOutcome?: (
    clinicId: string,
    eventId: string,
    nextResult: Record<string, unknown>,
  ) => Promise<number>;
  /** Relógio injetável (default: `Date.now()`). */
  now?: () => number;
}

async function defaultLoadRun(clinicId: string, eventId: string): Promise<OutcomeRunSnapshot | null> {
  const [row] = await getDb()
    .select({
      clinicId: agentRuns.clinicId,
      eventId: agentRuns.eventId,
      status: agentRuns.status,
      result: agentRuns.result,
      updatedAt: agentRuns.updatedAt,
    })
    .from(agentRuns)
    .where(and(eq(agentRuns.clinicId, clinicId), eq(agentRuns.eventId, eventId)))
    .limit(1);
  if (!row) return null;
  return {
    clinicId: row.clinicId,
    eventId: row.eventId,
    status: row.status,
    result: row.result,
    deliveredAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

async function defaultLoadBusinessEvents(clinicId: string): Promise<OutcomeBusinessEvent[]> {
  const rows = await getDb()
    .select({
      clinicId: businessEvents.clinicId,
      eventId: businessEvents.eventId,
      type: businessEvents.type,
      occurredAt: businessEvents.occurredAt,
      subjectType: businessEvents.subjectType,
      subjectId: businessEvents.subjectId,
    })
    .from(businessEvents)
    .where(eq(businessEvents.clinicId, clinicId));
  return rows.map((r) => ({
    clinicId: r.clinicId,
    eventId: r.eventId,
    type: r.type,
    occurredAt: r.occurredAt.toISOString(),
    subjectType: r.subjectType,
    subjectId: r.subjectId,
  }));
}

async function defaultSaveOutcome(
  clinicId: string,
  eventId: string,
  nextResult: Record<string, unknown>,
): Promise<number> {
  // UPDATE idempotente e atômico: a primeira escrita vence; replay casa 0
  // linhas (`affected=0` ⇒ `already_recorded`), sem duplicar outcome.
  const updated = await getDb()
    .update(agentRuns)
    .set({ result: nextResult, updatedAt: new Date() })
    .where(and(
      eq(agentRuns.clinicId, clinicId),
      eq(agentRuns.eventId, eventId),
      sql`${agentRuns.result}->>'outcome_telemetry' IS NULL`,
    ))
    .returning({ id: agentRuns.id });
  return updated.length;
}

export interface RecordOutcomeParams {
  clinicId: string;
  eventId: string;
}

export type RecordOutcomeResult =
  | { recorded: false; reason: string; outcome?: DerivedOutcome }
  | { recorded: true; outcome: DerivedOutcome; persisted: true };

/**
 * Deriva e registra o outcome da run (fail-closed, sem efeitos além do
 * UPDATE condicional do próprio `result`): run ausente/tenant divergente
 * dispensam SEM ler eventos e SEM escrever; transitório deriva SEM
 * escrever; replay encontra o outcome e NÃO reescreve.
 */
export async function recordOutcome(
  params: RecordOutcomeParams,
  deps: AiControlOutcomeDeps = {},
): Promise<RecordOutcomeResult> {
  const { clinicId, eventId } = params;
  if (!isNonEmptyString(clinicId) || !isNonEmptyString(eventId)) {
    return { recorded: false, reason: 'invalid_params' };
  }

  const loadRun = deps.loadRun ?? defaultLoadRun;
  const run = await loadRun(clinicId, eventId);
  if (!run) {
    return { recorded: false, reason: 'run_missing' };
  }
  if (run.clinicId !== clinicId) {
    return { recorded: false, reason: 'tenant_mismatch' };
  }

  const loadBusinessEvents = deps.loadBusinessEvents ?? defaultLoadBusinessEvents;
  const nowMs = deps.now ? deps.now() : Date.now();
  const events = await loadBusinessEvents(clinicId);
  const derived = deriveOutcome(run, events, nowMs);

  const guard = shouldPersistOutcome(run.result, derived);
  if (!guard.persist) {
    return { recorded: false, reason: guard.reason, outcome: derived };
  }

  const base =
    typeof run.result === 'object' && run.result !== null && !Array.isArray(run.result)
      ? (run.result as Record<string, unknown>)
      : {};
  const nextResult = { ...base, [OUTCOME_TELEMETRY_RESULT_KEY]: { ...derived } };
  const saveOutcome = deps.saveOutcome ?? defaultSaveOutcome;
  const affected = await saveOutcome(clinicId, eventId, nextResult);
  if (affected === 0) {
    // Segunda barreira: outro escritor registrou entre load e save — o
    // registro existente prevalece; NÃO sobrescreve.
    return { recorded: false, reason: 'already_recorded', outcome: derived };
  }
  return { recorded: true, outcome: derived, persisted: true };
}
