/**
 * P8 Slice 2a — fila de exceções + Approval Inbox (SOMENTE LEITURA).
 *
 * Tipos + projeção + priorização puros (sem JSX, sem I/O) compartilhados
 * entre o endpoint server-side (`services/api-handlers/dashboard/ai-queue`)
 * e as páginas client (`dashboard/ai/exceptions`, `dashboard/ai/approvals`).
 *
 * Fontes (seams single-table, SEMPRE com `clinic_id` da sessão — nunca join):
 * - `agent_runs`: decisão de política (`result.policy_decision`: APPROVAL /
 *   CONFIRM / DENY), execução (`result.execution_outcome`: suspended /
 *   failed), outcome (`result.outcome_telemetry`: failed_workflow /
 *   not_attributed), falha de prepare (`status = 'failed'` + `error_code`).
 * - `pending_actions`: risco (`risk_level`) + prazo (`undo_deadline`).
 * - `followup_journey_instances`: terminais (`stopped` / `expired`) + prazos
 *   (`due_at` / `feedback_deadline`).
 *
 * Allowlist de exposição: a resposta só carrega os campos de `AiQueueItem`.
 * `result` (jsonb) é lido no servidor APENAS para derivar escalares
 * sanitizados (`reason` em forma de código, `policyVersion`, `actionRef` em
 * forma de nome de catálogo) — o texto da proposta, `payload`, `sources`,
 * `subject_*`, `reasoning` e qualquer texto livre NUNCA atravessam.
 *
 * Buckets:
 * - `approval`: APPROVAL com proposta (`policy_decision`) ou ação pendente
 *   de risco alto (heurística documentada: `risk_level` HIGH/CRITICAL exige
 *   aprovação; demais exigem confirmação).
 * - `confirm`: CONFIRM ou ação pendente de risco não-alto.
 * - `reconcile`: execução `suspended` (efeito desconhecido — exige
 *   reconciliação manual, nunca retry).
 * - `failed`: falha operacional (prepare `failed`, execução `failed`,
 *   outcome `failed` fora de `failed_workflow`).
 * - `terminal`: não executável neste slice — DENY, `failed_workflow`,
 *   `not_attributed`, journeys `stopped`/`expired`. Só em filtro de
 *   diagnóstico, NUNCA como pendente.
 *
 * Priorização (anti-starvation): rank ASC, depois `createdAt` ASC (FIFO
 * dentro do rank — o mais antigo é atendido primeiro), depois `key` ASC.
 * rank 0 reconcile > rank 1 prazo vencido/próximo > rank 2 falhas >
 * rank 3 pendentes (approval/confirm) > rank 4 terminais (filtro separado).
 */

export const AI_QUEUE_DEFAULT_PAGE_SIZE = 20 as const;
export const AI_QUEUE_MAX_PAGE_SIZE = 50 as const;
/** Teto por fonte no DB (janela da fila rara; cobre a profundidade de paginação sem varredura). */
export const AI_QUEUE_SOURCE_CAP = 200 as const;

export const AI_QUEUE_VIEWS = ['approvals', 'exceptions'] as const;
export type AiQueueView = (typeof AI_QUEUE_VIEWS)[number];

export const AI_QUEUE_APPROVAL_FILTERS = ['all', 'approval', 'confirm'] as const;
export const AI_QUEUE_EXCEPTION_FILTERS = ['all', 'reconcile', 'failed', 'terminal'] as const;
export type AiQueueFilter =
  | (typeof AI_QUEUE_APPROVAL_FILTERS)[number]
  | (typeof AI_QUEUE_EXCEPTION_FILTERS)[number];

export type AiQueueSource = 'run' | 'pending_action' | 'journey';
export type AiQueueBucket =
  | 'approval'
  | 'confirm'
  | 'reconcile'
  | 'failed'
  | 'terminal';

export interface AiQueueItem {
  /** Identidade estável e opaca (`run:<uuid>` | `action:<uuid>` | `journey:<uuid>`). */
  key: string;
  source: AiQueueSource;
  bucket: AiQueueBucket;
  /** Literal do banco (`APPROVAL`, `suspended`, `stopped`, `pending`, ...). */
  state: string;
  /** Rótulo pt-BR derivado do bucket/estado. */
  label: string;
  /** Código sanitizado de motivo (forma `^[A-Za-z][A-Za-z0-9_]{1,63}$`) ou null. */
  reason: string | null;
  /** Correlação opaca (event_id / source_event_id) — nunca PII. */
  eventRef: string | null;
  /** Versão da política que decidiu (opaca) ou null. */
  policyVersion: string | null;
  /** Nome da Action do catálogo (forma `modulo.nome`) ou null. */
  actionRef: string | null;
  /** Prazo ISO quando existir (`undo_deadline` / `due_at`) ou null. */
  dueAt: string | null;
  /** Prazo vencido ou dentro de 24h (só com `dueAt`). */
  overdue: boolean;
  /** ISO string (ordenação FIFO dentro do rank). */
  createdAt: string;
}

export interface AiQueueResponse {
  items: AiQueueItem[];
  page: number;
  pageSize: number;
  /** Total na janela ordenada (limitada ao teto por fonte). */
  total: number;
  /** Há mais itens reais além desta página (página parcial/vazia ⇒ false). */
  hasMore: boolean;
}

const CODE_SHAPE = /^[A-Za-z][A-Za-z0-9_]{1,63}$/;
const POLICY_VERSION_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const ACTION_NAME_SHAPE = /^[a-z]+[a-z0-9]*\.[a-zA-Z][a-zA-Z0-9]*$/;
/** Janela de "prazo próximo" da heurística de `overdue` (vencido ou ≤24h). */
export const OVERDUE_WINDOW_MS = 24 * 60 * 60 * 1000;

function sanitizeCode(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length === 0 || t.length > 64) return null;
  return CODE_SHAPE.test(t) ? t : null;
}

function sanitizePolicyVersion(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length === 0 || t.length > 64) return null;
  return POLICY_VERSION_SHAPE.test(t) ? t : null;
}

function sanitizeActionRef(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return ACTION_NAME_SHAPE.test(t) ? t : null;
}

function sanitizeEventRef(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length === 0 || t.length > 128) return null;
  return t;
}

function toIso(v: unknown): string | null {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString();
  }
  if (typeof v === 'string' && v.length > 0) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  return null;
}

function readRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

/** Rótulo pt-BR do bucket (fallback: estado literal). */
export function aiQueueBucketLabel(bucket: AiQueueBucket, state: string): string {
  switch (bucket) {
    case 'approval':
      return 'aguarda aprovação';
    case 'confirm':
      return 'aguarda confirmação';
    case 'reconcile':
      return 'efeito desconhecido — reconciliar';
    case 'failed':
      return 'falha operacional';
    case 'terminal':
      return 'não executável neste slice';
    default:
      return state;
  }
}

export function aiQueueSourceLabel(source: AiQueueSource): string {
  switch (source) {
    case 'run':
      return 'execução IA';
    case 'pending_action':
      return 'ação pendente';
    case 'journey':
      return 'jornada';
    default:
      return source;
  }
}

/** Linha mínima de `agent_runs` lida pelo handler (projeção allowlist). */
export interface AiQueueRunRow {
  id: string;
  eventId: string;
  status: string;
  errorCode: string | null;
  result: unknown;
  createdAt: Date | string | null;
}

/**
 * Projeta UMA run para no máximo UM item da fila (precedência documentada:
 * reconcile > failed_workflow terminal > failed operacional > demais
 * terminais > approval > confirm; run saudável ⇒ null).
 * `failed_workflow` é terminal mesmo com falha operacional concomitante
 * (terminal preservado antes de failed operacional). `nowMs` é injetável
 * para testes determinísticos (prazo não se aplica a runs — mantido na
 * assinatura por simetria, ignorado).
 */
export function projectRunToQueueItem(
  row: AiQueueRunRow,
  _nowMs: number = Date.now(),
): AiQueueItem | null {
  void _nowMs;
  const result = readRecord(row.result);
  const policyDecision = result ? readRecord(result.policy_decision) : null;
  const execOutcome = result ? readRecord(result.execution_outcome) : null;
  const execStatus = typeof execOutcome?.status === 'string' ? execOutcome.status : null;
  const execEvidence = readRecord(execOutcome?.evidence);
  const outcome = result ? readRecord(result.outcome_telemetry) : null;
  const outcomeType = typeof outcome?.type === 'string' ? outcome.type : null;
  const outcomeStatus = typeof outcome?.status === 'string' ? outcome.status : null;
  const outcomeEvidence = readRecord(outcome?.evidence);
  const decision = typeof policyDecision?.decision === 'string' ? policyDecision.decision : null;
  const createdAt = toIso(row.createdAt) ?? new Date(0).toISOString();

  const base = {
    key: `run:${row.id}`,
    source: 'run' as const,
    eventRef: sanitizeEventRef(row.eventId),
    policyVersion: sanitizePolicyVersion(policyDecision?.policy_version),
    actionRef: sanitizeActionRef(policyDecision?.action_id),
    dueAt: null,
    overdue: false,
    createdAt,
  };

  // 1. Efeito desconhecido ⇒ reconciliação manual (nunca retry, nunca pendente).
  if (execStatus === 'suspended') {
    const reason = sanitizeCode(execEvidence?.reason);
    return {
      ...base,
      bucket: 'reconcile',
      state: 'suspended',
      label: aiQueueBucketLabel('reconcile', 'suspended'),
      reason,
    };
  }
  // 2. `failed_workflow` terminal preservado antes de failed operacional:
  //    mesmo com execução/prepare/outcome em falha concomitante, a run é
  //    diagnóstico terminal (nunca pendente, nunca falha retentável).
  if (outcomeType === 'failed_workflow') {
    return {
      ...base,
      bucket: 'terminal',
      state: 'failed_workflow',
      label: aiQueueBucketLabel('terminal', 'failed_workflow'),
      reason: sanitizeCode(outcomeEvidence?.reason),
    };
  }
  // 3. Falha operacional (execução ou prepare).
  if (execStatus === 'failed') {
    const reason = sanitizeCode(execEvidence?.reason);
    return {
      ...base,
      bucket: 'failed',
      state: 'failed',
      label: aiQueueBucketLabel('failed', 'failed'),
      reason,
    };
  }
  if (row.status === 'failed') {
    return {
      ...base,
      bucket: 'failed',
      state: 'failed',
      label: aiQueueBucketLabel('failed', 'failed'),
      reason: sanitizeCode(row.errorCode),
    };
  }
  if (outcomeStatus === 'failed' && outcomeType !== 'failed_workflow') {
    const reason = sanitizeCode(outcomeEvidence?.reason);
    return {
      ...base,
      bucket: 'failed',
      state: 'failed',
      label: aiQueueBucketLabel('failed', 'failed'),
      reason,
    };
  }
  // 4. Demais terminais — diagnóstico, nunca pendentes.
  if (decision === 'DENY') {
    return {
      ...base,
      bucket: 'terminal',
      state: 'DENY',
      label: aiQueueBucketLabel('terminal', 'DENY'),
      reason: sanitizeCode(policyDecision?.reason),
    };
  }
  if (outcomeStatus === 'not_attributed') {
    return {
      ...base,
      bucket: 'terminal',
      state: 'not_attributed',
      label: aiQueueBucketLabel('terminal', 'not_attributed'),
      reason: sanitizeCode(outcomeEvidence?.reason),
    };
  }
  // 5. Pendentes acionáveis (só com proposta: `policy_decision` presente).
  if (decision === 'APPROVAL') {
    return {
      ...base,
      bucket: 'approval',
      state: 'APPROVAL',
      label: aiQueueBucketLabel('approval', 'APPROVAL'),
      reason: sanitizeCode(policyDecision?.reason),
    };
  }
  if (decision === 'CONFIRM') {
    return {
      ...base,
      bucket: 'confirm',
      state: 'CONFIRM',
      label: aiQueueBucketLabel('confirm', 'CONFIRM'),
      reason: sanitizeCode(policyDecision?.reason),
    };
  }
  // Saudável (queued/observed AUTO/sem decisão): fora da fila.
  return null;
}

/** Linha mínima de `pending_actions` lida pelo handler (projeção allowlist). */
export interface AiQueuePendingActionRow {
  id: string;
  actionType: string;
  riskLevel: string | null;
  status: string;
  undoDeadline: Date | string | null;
  createdAt: Date | string | null;
}

/**
 * Heurística documentada: risco HIGH/CRITICAL exige aprovação; demais
 * exigem confirmação. `overdue` = prazo vencido ou dentro de 24h.
 */
export function projectPendingActionToQueueItem(
  row: AiQueuePendingActionRow,
  nowMs: number = Date.now(),
): AiQueueItem {
  const level = (row.riskLevel ?? '').trim().toUpperCase();
  const bucket: AiQueueBucket = level === 'HIGH' || level === 'CRITICAL' ? 'approval' : 'confirm';
  const dueAt = toIso(row.undoDeadline);
  const dueMs = dueAt === null ? null : Date.parse(dueAt);
  const overdue = dueMs !== null && dueMs - nowMs <= OVERDUE_WINDOW_MS;
  return {
    key: `action:${row.id}`,
    source: 'pending_action',
    bucket,
    state: row.status,
    label: aiQueueBucketLabel(bucket, row.status),
    reason: sanitizeCode(row.actionType),
    eventRef: null,
    policyVersion: null,
    actionRef: sanitizeActionRef(row.actionType),
    dueAt,
    overdue,
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
  };
}

/** Linha mínima de `followup_journey_instances` lida pelo handler. */
export interface AiQueueJourneyRow {
  id: string;
  journeyKind: string;
  state: string;
  outcome: string | null;
  dueAt: Date | string | null;
  sourceEventId: string | null;
  definitionVersion: string | null;
  createdAt: Date | string | null;
}

/**
 * Journeys SÓ entram como terminais de diagnóstico (`stopped`/`expired`);
 * qualquer outro estado ⇒ null (nunca pendente).
 */
export function projectJourneyToQueueItem(
  row: AiQueueJourneyRow,
  nowMs: number = Date.now(),
): AiQueueItem | null {
  void nowMs;
  if (row.state !== 'stopped' && row.state !== 'expired') return null;
  const dueAt = toIso(row.dueAt);
  return {
    key: `journey:${row.id}`,
    source: 'journey',
    bucket: 'terminal',
    state: row.state,
    label: aiQueueBucketLabel('terminal', row.state),
    reason: sanitizeCode(row.outcome),
    eventRef: sanitizeEventRef(row.sourceEventId),
    policyVersion: sanitizeCode(row.definitionVersion) ?? sanitizePolicyVersion(row.definitionVersion),
    actionRef: null,
    dueAt,
    overdue: false,
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
  };
}

/**
 * Rank de priorização (menor = mais urgente). Terminais ficam por último
 * porque vivem em filtro separado de diagnóstico.
 */
export function aiQueueRank(item: AiQueueItem): number {
  if (item.bucket === 'reconcile') return 0;
  if (item.overdue) return 1;
  if (item.bucket === 'failed') return 2;
  if (item.bucket === 'approval' || item.bucket === 'confirm') return 3;
  return 4;
}

/**
 * Ordenação determinística anti-starvation: rank ASC, `createdAt` ASC
 * (FIFO dentro do rank), `key` ASC como desempate final.
 */
export function sortAiQueueItems(items: AiQueueItem[]): AiQueueItem[] {
  return [...items].sort((a, b) => {
    const ra = aiQueueRank(a);
    const rb = aiQueueRank(b);
    if (ra !== rb) return ra - rb;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}

export interface AiQueueQuery {
  view: AiQueueView;
  filter: AiQueueFilter;
  page: number;
  pageSize: number;
}

/**
 * Valida `?view=&filter=&page=&pageSize=`. Filtros são cruzados por view:
 * approvals aceita `all|approval|confirm`; exceptions aceita
 * `all|reconcile|failed|terminal`. Retorna `{ error }` quando inválido
 * (o handler responde 400 sem tocar o DB).
 */
export function parseAiQueueQuery(
  params: URLSearchParams,
): { query: AiQueueQuery } | { error: string } {
  const viewRaw = (params.get('view') ?? 'approvals').trim().toLowerCase();
  if (viewRaw !== 'approvals' && viewRaw !== 'exceptions') {
    return { error: `view inválida: use ${AI_QUEUE_VIEWS.join('|')}` };
  }
  const view = viewRaw as AiQueueView;
  const allowedFilters = view === 'approvals' ? AI_QUEUE_APPROVAL_FILTERS : AI_QUEUE_EXCEPTION_FILTERS;
  const filterRaw = (params.get('filter') ?? 'all').trim().toLowerCase();
  if (!(allowedFilters as readonly string[]).includes(filterRaw)) {
    return { error: `filter inválido para ${view}: use ${allowedFilters.join('|')}` };
  }
  const pageRaw = params.get('page') ?? '1';
  const pageSizeRaw = params.get('pageSize') ?? String(AI_QUEUE_DEFAULT_PAGE_SIZE);
  const page = Number(pageRaw);
  const pageSize = Number(pageSizeRaw);
  if (!Number.isInteger(page) || page < 1) {
    return { error: 'page deve ser inteiro >= 1' };
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > AI_QUEUE_MAX_PAGE_SIZE) {
    return { error: `pageSize deve ser inteiro entre 1 e ${AI_QUEUE_MAX_PAGE_SIZE}` };
  }
  return { query: { view, filter: filterRaw as AiQueueFilter, page, pageSize } };
}
