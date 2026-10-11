/**
 * Controle de manutenção do outbox — pause/resume/drain com o PostgreSQL como
 * autoridade (migration 0036 expandida).
 *
 * Estado singleton em `outbox_control` (linha `id = 1`). O consumo é gateado em
 * DOIS lugares, de propósito:
 *
 *  1. `claimOutboxJob` (código) toma o advisory lock compartilhado do controle
 *     dentro da transação do claim — pause-vs-claim é race-safe nas duas
 *     direções, e claims concorrentes (jobs distintos) não serializam entre si;
 *  2. trigger `outbox_enforce_control_gate` (banco) — alcança binário antigo e
 *     dispatch direto por SQL, que não leem estado algum.
 *
 * O lock é `pg_advisory_xact_lock_shared` nos leitores (claim/liquidação +
 * trigger) e `pg_advisory_xact_lock` exclusivo no pause/resume — de propósito,
 * em vez de `SELECT ... FOR SHARE`: o lock de linha exige privilégio UPDATE e
 * quebraria o contrato SELECT-only do runtime em `outbox_control`. Advisory
 * lock transacional não exige privilégio na tabela e é liberado no
 * COMMIT/ROLLBACK.
 *
 * Regras preservadas:
 *  - `enqueueOutbox` continua disponível e transacional durante o pause (INSERT
 *    não é gateado);
 *  - liquidação de lease legado PRÉ-PROTOCOLO (`claim_release IS NULL`, já em
 *    voo na migração/pause) continua possível DURANTE o pause, para a fila
 *    drenar; liquidação SEM o marcador transacional `<release>#<geração>` de
 *    linha portadora de release é negada com o gate ARMADO (RUNNING) e também
 *    durante o pause;
 *  - redação LGPD/cancelamento (`status = 'cancelled'`) nunca é bloqueado;
 *  - falha fechada quando a linha/tabela de controle não está disponível;
 *  - resume NUNCA abandona trabalho em voo: `processing > 0` bloqueia sempre.
 *
 * Identidade do caller (migration 0036 expandida): o claim e toda liquidação
 * armam `set_config('outbox.claim_marker', '<release>#<claim_generation>', true)`
 * na MESMA transação, e o trigger só aceita a transição quando o token casa com
 * a linha. O valor da linha (`claim_release`) sozinho não autentica ninguém —
 * sem o GUC transacional, um UPDATE solto de binário antigo é recusado.
 *
 * Superfície de administração = primitivas de repositório/script. NÃO existe
 * endpoint público de controle: status só pelo readiness/health autenticado.
 */
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { outboxControl, outboxJobs } from '@/core/schema/infra';
import { OUTBOX_OPERATIONS, type OutboxOperation } from './operations';
import { UNKNOWN_RELEASE, normalizeReleaseId } from './consumer-release';

/** Linha única do estado de controle. */
export const OUTBOX_CONTROL_ID = 1;

/**
 * Advisory lock transacional do controle (chave fixa de 64 bits).
 *
 * Leitores (claim/liquidação/trigger) tomam o modo COMPARTILHADO
 * (`pg_advisory_xact_lock_shared`); pause/resume tomam o modo EXCLUSIVO
 * (`pg_advisory_xact_lock`). Compartilhados coexistem; exclusivo conflita com
 * qualquer leitor — é o que serializa pause-vs-claim sem exigir UPDATE na
 * tabela (SELECT-only do runtime continua funcionando). Liberado no
 * COMMIT/ROLLBACK, por transação.
 */
export const OUTBOX_CONTROL_ADVISORY_KEY = 8104312345678901;

/** Lease de processamento observável — NÃO é prova de drain. */
export const OUTBOX_LEASE_MS = 5 * 60 * 1000;

/** Motivo default quando o operador não informa um. */
export const DEFAULT_PAUSE_REASON = 'maintenance';

/** Teto de `reason`/`operator` sanitizados. */
const CONTROL_TEXT_MAX = 200;

/**
 * Erro de controle com código ESTÁTICO — nunca carrega entrada do operador,
 * mensagem de driver ou PII (códigos aparecem em logs e respostas).
 */
export class OutboxControlError extends Error {
  readonly code: string;
  readonly details?: Record<string, number>;
  constructor(code: string, details?: Record<string, number>) {
    super(code);
    this.name = 'OutboxControlError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Padrões de redação — `reason`/`operator` são texto livre do operador, mas o
 * estado vaza para status/health/log. Redação conservadora por construção:
 * e-mail, CPF, telefones, JWT, token/senha em `chave=valor` e runs longos
 * (sha/token). Nunca o inverso: texto legítimo ("pause for migration 0036
 * backfill") passa intacto.
 */
const CONTROL_REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+/g, '[redacted]'],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[redacted]'],
  [/\+\d[\d\s().-]{8,}\d/g, '[redacted]'],
  [/\b\d{11}\b/g, '[redacted]'],
  [/\b\d{10}\b/g, '[redacted]'],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted]'],
  [/\b(bearer|token|secret|password|passwd|pwd|api[_-]?key|authorization)\b\s*[:=]\s*\S+/gi, '$1=[redacted]'],
  [/\b[A-Za-z0-9]{40,}\b/g, '[redacted]'],
];

/**
 * Sanitiza texto de controle: normaliza, remove caracteres de controle, colapsa
 * espaços, redige PII/segredo e aplica teto de tamanho. `null` quando não sobra
 * conteúdo utilizável.
 */
export function sanitizeControlText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let text = raw
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  for (const [pattern, replacement] of CONTROL_REDACTIONS) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.slice(0, CONTROL_TEXT_MAX);
}

export type OutboxControlSnapshot = {
  id: number;
  paused: boolean;
  epoch: number;
  reason: string | null;
  operator: string | null;
  releaseId: string | null;
  pausedAt: Date | null;
  resumedAt: Date | null;
  updatedAt: Date | null;
};

export type OutboxStatusCounts = {
  pending: number;
  processing: number;
  delivered: number;
  deadLetter: number;
  cancelled: number;
  /** `processing` com lease vencido — observável, mas NÃO prova drain. */
  staleProcessing: number;
};

/** Metadados sem payload/PII para identificar leases ativos e sua release. */
export type ProcessingOutboxJob = {
  jobId: string;
  operation: OutboxOperation | 'unknown';
  claimGeneration: number;
  claimRelease: string | null;
  updatedAt: Date;
  stale: boolean;
};

export type OutboxControlStatus = OutboxControlSnapshot & {
  leaseMs: number;
  counts: OutboxStatusCounts;
  /** Lista limitada e redigida: só id aleatório, generation, release e timestamps. */
  processingJobs: ProcessingOutboxJob[];
  processingJobsComplete: boolean;
  /** `true` somente quando NÃO há linha `processing` (nunca por lease velho). */
  drained: boolean;
};

/** Vista mínima do controle usada pelo gate do claim. */
export type OutboxControlGate = { paused: boolean; releaseId: string | null };

function toSnapshot(row: typeof outboxControl.$inferSelect): OutboxControlSnapshot {
  return {
    id: row.id,
    paused: row.paused === true,
    epoch: row.epoch,
    reason: row.reason ?? null,
    operator: row.operator ?? null,
    releaseId: row.releaseId ?? null,
    pausedAt: row.pausedAt ?? null,
    resumedAt: row.resumedAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

/**
 * Leitura do gate dentro de uma transação de claim, sob advisory lock
 * COMPARTILHADO — serializa contra pause/resume (que toma o exclusivo) sem
 * serializar claims/liquidações concorrentes entre si, e sem exigir UPDATE na
 * tabela (compatível com o runtime SELECT-only). Falha FECHADA: sem
 * linha/tabela de controle não há claim.
 *
 * Ordem estável de locks: advisory compartilhado → job row (exclusivo).
 * Nenhum caminho faz o inverso, então não há inversão claim-vs-pause.
 */
export async function readControlForClaim(tx: {
  select: (...args: unknown[]) => unknown;
  execute: (...args: unknown[]) => unknown;
}): Promise<OutboxControlGate> {
  try {
    await (tx as any).execute(
      sql`SELECT pg_advisory_xact_lock_shared(${OUTBOX_CONTROL_ADVISORY_KEY})`,
    );
    const rows = await (tx as any).select({
      paused: outboxControl.paused,
      releaseId: outboxControl.releaseId,
    })
      .from(outboxControl)
      .where(eq(outboxControl.id, OUTBOX_CONTROL_ID));
    const row = (rows as Array<{ paused: boolean; releaseId: string | null }>)[0];
    if (!row) throw new OutboxControlError('OUTBOX_CONTROL_UNAVAILABLE');
    return { paused: row.paused === true, releaseId: row.releaseId ?? null };
  } catch (error) {
    if (error instanceof OutboxControlError) throw error;
    throw new OutboxControlError('OUTBOX_CONTROL_UNAVAILABLE');
  }
}

/**
 * Linha de controle sob lock EXCLUSIVO — usado só por pause/resume, que
 * ESCREVEM a linha. O exclusivo aqui tem DUAS camadas: o advisory lock
 * (`pg_advisory_xact_lock`, que conflita com os leitores compartilhados do
 * claim/trigger) e o `FOR UPDATE` na linha (que o admin/operador possui).
 * Leitores nunca tomam `FOR UPDATE`/`FOR SHARE`, então o runtime SELECT-only
 * continua podendo claimar/liquidar.
 */
async function loadControlRow(tx: {
  select: (...args: unknown[]) => unknown;
  execute: (...args: unknown[]) => unknown;
}) {
  await (tx as any).execute(
    sql`SELECT pg_advisory_xact_lock(${OUTBOX_CONTROL_ADVISORY_KEY})`,
  );
  const rows = await (tx as any).select().from(outboxControl)
    .where(eq(outboxControl.id, OUTBOX_CONTROL_ID)).for('update');
  const row = (rows as Array<typeof outboxControl.$inferSelect>)[0];
  if (!row) throw new OutboxControlError('OUTBOX_CONTROL_UNAVAILABLE');
  return row;
}

/**
 * Fail-closed authorization for mutating the singleton. The app roles need only
 * SELECT to consume; pause/resume are operator actions and require UPDATE on the
 * control row from a non-runtime role.
 */
async function assertControlMutationAuthority(tx: { execute: (...args: unknown[]) => unknown }): Promise<void> {
  const result = await (tx as any).execute(sql`
    SELECT current_user::text AS role_name,
           has_table_privilege(current_user, 'public.outbox_control', 'UPDATE') AS can_update
  `);
  const row = (result as { rows?: Array<{ role_name?: string; can_update?: boolean }> })?.rows?.[0];
  const roleName = row?.role_name;
  if (
    row?.can_update !== true
    || roleName === 'synkroo_app'
    || roleName === 'synkroo_staging_app'
  ) {
    throw new OutboxControlError('OUTBOX_CONTROL_ADMIN_REQUIRED');
  }
}

/** Contagem de linhas `processing` (global — pause não introduz escopo tenant). */
async function countProcessing(tx: { execute: (...args: unknown[]) => unknown }): Promise<number> {
  const result = await (tx as any).execute(
    sql`SELECT count(*)::int AS processing FROM ${outboxJobs} WHERE ${outboxJobs.status} = 'processing'`,
  );
  const raw = (result as { rows?: Array<{ processing?: number | string }> })?.rows?.[0]?.processing ?? 0;
  return typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10) || 0;
}

export type PauseOutboxInput = {
  reason?: string | null;
  operator?: string | null;
};

/**
 * Pausa o consumo. Exclusivo: já pausado ⇒ `OUTBOX_ALREADY_PAUSED` (o operador
 * consulta o status antes). Incrementa a epoch (CAS do resume).
 */
export async function pauseOutboxConsumption(
  input: PauseOutboxInput = {},
): Promise<OutboxControlSnapshot> {
  const reason = sanitizeControlText(input.reason) ?? DEFAULT_PAUSE_REASON;
  const operator = sanitizeControlText(input.operator);
  const db = getDb();
  return db.transaction(async (tx: any) => {
    await assertControlMutationAuthority(tx);
    const current = await loadControlRow(tx);
    if (current.paused) throw new OutboxControlError('OUTBOX_ALREADY_PAUSED');
    const [updated] = await tx.update(outboxControl).set({
      paused: true,
      epoch: current.epoch + 1,
      reason,
      operator,
      pausedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(outboxControl.id, OUTBOX_CONTROL_ID),
      eq(outboxControl.epoch, current.epoch),
      eq(outboxControl.paused, false),
    )).returning();
    return toSnapshot(updated);
  });
}

export type ResumeOutboxInput = {
  /** Epoch atual (lida do status) — CAS: resume só com a epoch esperada. */
  expectedEpoch: number;
  /** Release que passa a comandar o gate (obrigatório, nunca `unknown`). */
  releaseId: string | null | undefined;
  operator?: string | null;
};

/**
 * Resume explícito: CAS por epoch + identificador de release. Arma o gate
 * (`release_id`) — a partir daí, claim e liquidação sem aquele release são
 * negados pelo trigger (binário antigo não claima mais).
 *
 * NÃO existe "force": resume com `processing > 0` é SEMPRE recusado
 * (`OUTBOX_RESUME_BLOCKED_PROCESSING`). Abandonar lease em voo descartaria um
 * envio já iniciado (duplicate-send na reexecução); enquanto o pause está
 * ativo, a liquidação do trabalho em andamento continua liberada para a fila
 * DRENAR — o operador espera `processing = 0` e retoma. Linha `processing`
 * abandonada/ambígua mantém NO-GO: não existe force/reset/retry genérico; o
 * resultado externo precisa de reconciliação por domínio e autorização antes
 * de qualquer settlement manual. A opção LGPD `cancelled` é um fluxo separado,
 * não um mecanismo para limpar leases de manutenção.
 */
export async function resumeOutboxConsumption(
  input: ResumeOutboxInput,
): Promise<OutboxControlSnapshot> {
  const expectedEpoch = Number.isFinite(input.expectedEpoch) ? Math.trunc(input.expectedEpoch as number) : Number.NaN;
  if (!Number.isInteger(expectedEpoch) || expectedEpoch < 0) {
    throw new OutboxControlError('OUTBOX_EPOCH_INVALID');
  }
  // Identidade NUNCA passa pelo sanitizador de PII (redigiria sha/UUID):
  // validação canônica por padrão + teto, compartilhada com o claim.
  const rawRelease = typeof input.releaseId === 'string' ? input.releaseId.trim() : '';
  if (!rawRelease) throw new OutboxControlError('OUTBOX_RELEASE_REQUIRED');
  if (rawRelease.toLowerCase() === UNKNOWN_RELEASE) throw new OutboxControlError('OUTBOX_RELEASE_UNKNOWN');
  const releaseId = normalizeReleaseId(rawRelease);
  if (!releaseId) throw new OutboxControlError('OUTBOX_RELEASE_INVALID');
  const operator = sanitizeControlText(input.operator);

  const db = getDb();
  return db.transaction(async (tx: any) => {
    await assertControlMutationAuthority(tx);
    const current = await loadControlRow(tx);
    if (!current.paused) throw new OutboxControlError('OUTBOX_NOT_PAUSED');
    if (current.epoch !== expectedEpoch) throw new OutboxControlError('OUTBOX_EPOCH_MISMATCH');

    const processing = await countProcessing(tx);
    if (processing > 0) {
      throw new OutboxControlError('OUTBOX_RESUME_BLOCKED_PROCESSING', { processing });
    }

    const [updated] = await tx.update(outboxControl).set({
      paused: false,
      epoch: current.epoch + 1,
      releaseId,
      operator,
      resumedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(outboxControl.id, OUTBOX_CONTROL_ID),
      eq(outboxControl.epoch, current.epoch),
      eq(outboxControl.paused, true),
    )).returning();
    return toSnapshot(updated);
  });
}

/**
 * Status observável: contagens (com `staleProcessing`), epoch/release do pause,
 * motivo sanitizado. `drained` é verdadeiro SOMENTE sem nenhuma linha
 * `processing` — lease vencido não é prova de drain.
 */
export async function getOutboxControlStatus(): Promise<OutboxControlStatus> {
  const db = getDb();
  const [control] = await db.select().from(outboxControl)
    .where(eq(outboxControl.id, OUTBOX_CONTROL_ID));
  if (!control) throw new OutboxControlError('OUTBOX_CONTROL_UNAVAILABLE');

  const countsResult = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE ${outboxJobs.status} = 'pending')::int AS pending,
      count(*) FILTER (WHERE ${outboxJobs.status} = 'processing')::int AS processing,
      count(*) FILTER (WHERE ${outboxJobs.status} = 'delivered')::int AS delivered,
      count(*) FILTER (WHERE ${outboxJobs.status} = 'dead_letter')::int AS dead_letter,
      count(*) FILTER (WHERE ${outboxJobs.status} = 'cancelled')::int AS cancelled,
      count(*) FILTER (WHERE ${outboxJobs.status} = 'processing'
        AND ${outboxJobs.updatedAt} < NOW() - interval '5 minutes')::int AS stale_processing
    FROM ${outboxJobs}
  `);
  const countsRow = (countsResult as { rows?: Array<Record<string, number | string | undefined>> })?.rows?.[0] ?? {};
  const toInt = (value: number | string | undefined): number =>
    typeof value === 'number' ? value : Number.parseInt(String(value ?? '0'), 10) || 0;
  const counts: OutboxStatusCounts = {
    pending: toInt(countsRow.pending),
    processing: toInt(countsRow.processing),
    delivered: toInt(countsRow.delivered),
    deadLetter: toInt(countsRow.dead_letter),
    cancelled: toInt(countsRow.cancelled),
    staleProcessing: toInt(countsRow.stale_processing),
  };

  const processingResult = await db.execute(sql`
    SELECT id, operation, claim_generation, claim_release, updated_at,
           (updated_at < NOW() - interval '5 minutes') AS stale
      FROM ${outboxJobs}
     WHERE ${outboxJobs.status} = 'processing'
     ORDER BY ${outboxJobs.updatedAt}
     LIMIT 500
  `);
  const processingRows = (processingResult as unknown as {
    rows?: Array<{
      id: string;
      operation: string;
      claim_generation: number | string;
      claim_release: string | null;
      updated_at: Date | string;
      stale: boolean;
    }>;
  })?.rows ?? [];
  const knownOperations = new Set<string>(Object.values(OUTBOX_OPERATIONS));
  const processingJobs: ProcessingOutboxJob[] = processingRows.map((job) => ({
    jobId: job.id,
    operation: knownOperations.has(job.operation) ? job.operation as OutboxOperation : 'unknown',
    claimGeneration: toInt(job.claim_generation),
    claimRelease: job.claim_release ?? null,
    updatedAt: job.updated_at instanceof Date ? job.updated_at : new Date(job.updated_at),
    stale: job.stale === true,
  }));

  return {
    ...toSnapshot(control),
    leaseMs: OUTBOX_LEASE_MS,
    counts,
    processingJobs,
    processingJobsComplete: processingJobs.length === counts.processing,
    drained: counts.processing === 0,
  };
}
