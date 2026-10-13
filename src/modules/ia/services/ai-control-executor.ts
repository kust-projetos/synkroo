/**
 * P4 Slice 3 — execution + verification em workflow estreito.
 *
 * Executor gateado, desligado por default, SEM efeitos reais fora de testes:
 * só executa quando `AI_CONTROL_MODE=auto_limitado` (novo modo; `off`/`observe`
 * e qualquer outro valor dispensam SEM efeito e SEM escrita). O default do
 * sistema continua `observe` — este slice não altera nenhum default existente.
 *
 * Escopo estreito (allowlist explícita e mínima, 1 action):
 * `operacional.obterPaciente` — leitura verificável, a de menor risco:
 * `riskClass` padrão (`standard`), NÃO consequencial (sem tentativa em
 * `action_logs`, sem efeito externo), permissão só de leitura
 * (`operacional:view`), handler tenant-scoped. Nenhuma outra action é
 * executável por este módulo (fora da allowlist ⇒ nunca executa, sem escrita).
 *
 * Correlação: o receipt amarra run→attempt (`attempt_id` quando o `runAction`
 * o expõe — para action não-consequencial é `null` por contrato — mais
 * `action_id` e política versionada). Idempotência via chave determinística
 * `p4s3:exec:{clinicId}:{eventId}:{actionId}:{policyVersion}`: replay do mesmo
 * run encontra o receipt já gravado e NÃO re-executa (verifica antes).
 *
 * Verificação determinística pós-execução (verifier puro por tipo): `ok` do
 * `runAction` NÃO basta — exige pós-condição lida do backend (`readBack`
 * injetável; default: releitura via registry). `unknown_effect` (ou verifier
 * `unknown`) ⇒ estado `suspended` + reconciliação manual, SEM retry cego e
 * SEM marcar sucesso.
 *
 * Outcome registrado em `result.execution_outcome`: `business_success` |
 * `suspended` | `failed`, com evidência e duração. Enqueue (quando houver, em
 * slices futuros) significa aguardando — nunca entregue: este módulo nunca
 * marca `delivered` nem liquida outbox.
 *
 * Persistência: reuso da coluna `result` jsonb (`execution_receipt` +
 * `execution_outcome`) — nenhuma migration neste slice. UPDATE condicional
 * com predicado de ausência (`result->>'execution_receipt' IS NULL`) fecha a
 * corrida TOCTOU igual ao Slice 2.
 *
 * Este módulo NÃO importa LLM, RAG, serviços de envio, gateways nem handlers
 * de mutação de domínio (coberto por teste estático). A execução real passa
 * pela seam injetável `runAction` (default: registry + `runAction` do core);
 * testes usam mocks — nenhum efeito real fora de testes.
 */
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { getAction } from '@/core/actions/registry';
import { runAction as coreRunAction } from '@/core/actions/run';
import type { ActionContext } from '@/core/actions/types';
import {
  AI_CONTROL_POLICY_VERSION,
  type ProposalPolicyDecision,
} from './ai-control-policy';
import { agentRuns } from '@/modules/ia/schema/observe';

/** Versão da política de execução deste slice — gravada em cada receipt. */
export const AI_CONTROL_EXEC_POLICY_VERSION = 'p4-s3-exec-v1' as const;

/** Único modo que autoriza execução. Novo modo; default do sistema segue `observe`. */
export const AI_CONTROL_EXEC_MODE = 'auto_limitado' as const;

/**
 * Allowlist explícita e mínima deste slice: SOMENTE leitura verificável.
 * `operacional.obterPaciente`: standard, não-consequencial, `operacional:view`.
 */
export const AI_CONTROL_EXEC_ALLOWLIST = ['operacional.obterPaciente'] as const;

export type ExecAllowlistedAction = (typeof AI_CONTROL_EXEC_ALLOWLIST)[number];

/** Chaves jsonb sob as quais receipt/outcome vivem dentro de `agent_runs.result`. */
export const EXECUTION_RECEIPT_RESULT_KEY = 'execution_receipt' as const;
export const EXECUTION_OUTCOME_RESULT_KEY = 'execution_outcome' as const;

export type ExecutionOutcomeStatus = 'business_success' | 'suspended' | 'failed';

/** Veredito do verifier puro: ok / falha de pós-condição / leitura indisponível. */
export type VerificationVerdict = 'ok' | 'failed' | 'unknown';

export interface ExecutionReceipt {
  /** Chave determinística de idempotência (replay ⇒ mesma chave ⇒ skip). */
  idempotency_key: string;
  /** Nome da Action do catálogo (nunca string livre — só allowlist). */
  action_id: ExecAllowlistedAction;
  /** Versão da política de decisão (S2) que autorizou o AUTO. */
  policy_version: string;
  /** Versão da política de execução (este slice). */
  exec_policy_version: typeof AI_CONTROL_EXEC_POLICY_VERSION;
  /** Referência da tentativa do `runAction` (`null` p/ não-consequencial). */
  attempt_id: string | null;
  duration_ms: number;
}

export interface ExecutionOutcome {
  status: ExecutionOutcomeStatus;
  /** Evidência sanitizada: códigos/vereditos, nunca PII ou input bruto. */
  evidence: Record<string, unknown>;
  duration_ms: number;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Gate de modo de execução. Default `observe` (sistema continua desligado por
 * padrão); SOMENTE `auto_limitado` autoriza. Normaliza igual ao Slice 1B
 * (trim + lowercase) para comportamento consistente do mesmo env.
 */
export function readAiControlExecMode(
  readEnv: () => string | undefined = () => process.env.AI_CONTROL_MODE,
): string {
  return (readEnv() ?? 'observe').trim().toLowerCase();
}

export function isAiControlExecEnabled(mode: string): boolean {
  return mode === AI_CONTROL_EXEC_MODE;
}

/** Chave determinística de idempotência — pura, mesma tupla ⇒ mesma chave. */
export function buildExecutionIdempotencyKey(
  clinicId: string,
  eventId: string,
  actionId: string,
  policyVersion: string,
): string {
  return `p4s3:exec:${clinicId}:${eventId}:${actionId}:${policyVersion}`;
}

export function isAllowlistedAction(actionId: unknown): actionId is ExecAllowlistedAction {
  return (
    typeof actionId === 'string'
    && (AI_CONTROL_EXEC_ALLOWLIST as readonly string[]).includes(actionId)
  );
}

export function hasExecutionReceipt(result: unknown): boolean {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) return false;
  const key = EXECUTION_RECEIPT_RESULT_KEY;
  return (
    Object.prototype.hasOwnProperty.call(result, key)
    && (result as Record<string, unknown>)[key] !== undefined
    && (result as Record<string, unknown>)[key] !== null
  );
}

export function getExecutionReceipt(result: unknown): ExecutionReceipt | null {
  if (!hasExecutionReceipt(result)) return null;
  return (result as Record<string, unknown>)[EXECUTION_RECEIPT_RESULT_KEY] as ExecutionReceipt;
}

export function mergeExecutionRecord(
  result: unknown,
  receipt: ExecutionReceipt,
  outcome: ExecutionOutcome,
): Record<string, unknown> {
  const base =
    typeof result === 'object' && result !== null && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : {};
  return {
    ...base,
    [EXECUTION_RECEIPT_RESULT_KEY]: { ...receipt },
    [EXECUTION_OUTCOME_RESULT_KEY]: { ...outcome },
  };
}

/**
 * Guarda pura do gate de decisão: só AUTO + `action_id` da allowlist executa.
 * Qualquer outra coisa (DENY/CONFIRM/APPROVAL, action nula/fora da allowlist,
 * decisão ausente) ⇒ dispensa sem efeito. Determinística.
 */
export function canExecuteDecision(
  decision: ProposalPolicyDecision | null | undefined,
): { executable: boolean; reason: string } {
  if (!decision || typeof decision !== 'object') {
    return { executable: false, reason: 'no_decision' };
  }
  if (decision.decision !== 'AUTO') {
    return { executable: false, reason: 'not_auto' };
  }
  if (!isAllowlistedAction(decision.action_id)) {
    return { executable: false, reason: 'not_allowlisted' };
  }
  return { executable: true, reason: 'ok' };
}

export interface ExecRunSnapshot {
  clinicId: string;
  status: string;
  result: unknown;
}

/**
 * Guarda pura da persistência: tenant esperado, ainda sem receipt. (O gate de
 * modo/decisão/allowlist é avaliado antes, também puro — ver `canExecuteDecision`.)
 */
export function shouldPersistExecution(
  run: ExecRunSnapshot | null | undefined,
  clinicId: string,
): { persist: boolean; reason: string } {
  if (!run || typeof run !== 'object') return { persist: false, reason: 'run_missing' };
  if (run.clinicId !== clinicId) return { persist: false, reason: 'tenant_mismatch' };
  if (hasExecutionReceipt(run.result)) return { persist: false, reason: 'already_executed' };
  return { persist: true, reason: 'ok' };
}

/* ------------------------------------------------------------------ *
 * Verifiers puros por Action (sem I/O, sem relógio, sem aleatoriedade).
 * `ok` exige pós-condição LIDA DO BACKEND — nunca basta o retorno `ok`.
 * ------------------------------------------------------------------ */

/**
 * Pós-condição de `operacional.obterPaciente`: a releitura do backend deve
 * devolver a linha do paciente pedido (mesmo `id`). Linha ausente/divergente
 * ⇒ `failed`; leitura indisponível (`null` por falha de infra do readBack)
 * ⇒ `unknown` (suspende, sem afirmar nem negar o efeito).
 */
export function verifyObterPaciente(
  requestedPatientId: unknown,
  readBack: unknown,
): VerificationVerdict {
  if (readBack === null || readBack === undefined) return 'unknown';
  if (typeof readBack !== 'object' || Array.isArray(readBack)) return 'failed';
  const row = readBack as Record<string, unknown>;
  if (!isNonEmptyString(requestedPatientId)) return 'failed';
  return row.id === requestedPatientId ? 'ok' : 'failed';
}

export type ExecVerifier = (requestedInput: unknown, readBack: unknown) => VerificationVerdict;

const VERIFIERS: Record<ExecAllowlistedAction, ExecVerifier> = {
  'operacional.obterPaciente': (input, readBack) => {
    const patientId =
      typeof input === 'object' && input !== null
        ? (input as Record<string, unknown>).id ?? (input as Record<string, unknown>).patientId
        : undefined;
    return verifyObterPaciente(patientId, readBack);
  },
};

export function getExecVerifier(actionId: ExecAllowlistedAction): ExecVerifier {
  return VERIFIERS[actionId];
}

/* ------------------------------------------------------------------ *
 * Seams injetáveis (testes usam mocks — nenhum efeito real fora de testes).
 * ------------------------------------------------------------------ */

/** Resultado mínimo que o executor precisa do `runAction` (ok / erro + attempt). */
export interface ExecRunActionResult {
  ok: boolean;
  data?: unknown;
  errorCode?: string;
  /** Referência da tentativa quando o core a expõe (`unknown_effect`). */
  attemptId?: string | null;
}

export interface AiControlExecutorDeps {
  /** Leitura do gate (default: `process.env.AI_CONTROL_MODE`). */
  readMode?: () => string;
  /** Carga da run (default: `agent_runs` com predicado de tenant). */
  loadRun?: (clinicId: string, eventId: string) => Promise<ExecRunSnapshot | null>;
  /** UPDATE condicional; devolve linhas afetadas (0 = replay venceu antes). */
  saveExecution?: (
    clinicId: string,
    eventId: string,
    nextResult: Record<string, unknown>,
  ) => Promise<number>;
  /**
   * Execução via core (default: resolve a Action no registry e chama o
   * `runAction` real — SÓ alcançável com modo + AUTO + allowlist). Injetável
   * para testes mockarem SEM efeito real.
   */
  runAction?: (
    actionId: ExecAllowlistedAction,
    input: unknown,
    ctx: ActionContext,
  ) => Promise<ExecRunActionResult>;
  /**
   * Releitura pós-execução direto do backend (default: re-resolve a Action no
   * registry e re-executa como leitura de verificação tenant-scoped).
   * `null` = leitura indisponível ⇒ verifier `unknown` ⇒ `suspended`.
   */
  readBack?: (
    actionId: ExecAllowlistedAction,
    input: unknown,
    ctx: ActionContext,
  ) => Promise<unknown>;
  /** Verifier puro por Action (default: mapa `VERIFIERS`). */
  verify?: (actionId: ExecAllowlistedAction, input: unknown, readBack: unknown) => VerificationVerdict;
}

async function defaultLoadRun(clinicId: string, eventId: string): Promise<ExecRunSnapshot | null> {
  const [row] = await getDb()
    .select({
      clinicId: agentRuns.clinicId,
      status: agentRuns.status,
      result: agentRuns.result,
    })
    .from(agentRuns)
    .where(and(eq(agentRuns.clinicId, clinicId), eq(agentRuns.eventId, eventId)))
    .limit(1);
  return row ?? null;
}

async function defaultSaveExecution(
  clinicId: string,
  eventId: string,
  nextResult: Record<string, unknown>,
): Promise<number> {
  // UPDATE idempotente e atômico: a primeira escrita vence; replay casa 0
  // linhas (`affected=0` ⇒ `already_executed`), sem sobrescrever receipt.
  const updated = await getDb()
    .update(agentRuns)
    .set({ result: nextResult, updatedAt: new Date() })
    .where(and(
      eq(agentRuns.clinicId, clinicId),
      eq(agentRuns.eventId, eventId),
      sql`${agentRuns.result}->>'execution_receipt' IS NULL`,
    ))
    .returning({ id: agentRuns.id });
  return updated.length;
}

async function defaultRunAction(
  actionId: ExecAllowlistedAction,
  input: unknown,
  ctx: ActionContext,
): Promise<ExecRunActionResult> {
  const action = getAction(actionId);
  if (!action) {
    return { ok: false, errorCode: 'unknown_action', attemptId: null };
  }
  const out = await coreRunAction(action, input, ctx);
  if (out.ok) return { ok: true, data: out.data, attemptId: null };
  return { ok: false, errorCode: out.error.code, attemptId: out.error.attemptId ?? null };
}

async function defaultReadBack(
  actionId: ExecAllowlistedAction,
  input: unknown,
  ctx: ActionContext,
): Promise<unknown> {
  // Releitura de verificação pelo MESMO caminho tenant-scoped da execução
  // (nunca pelo retorno do run — a pós-condição vem do backend).
  const action = getAction(actionId);
  if (!action) return null;
  const out = await coreRunAction(action, input, ctx);
  if (!out.ok) return null;
  return out.data ?? null;
}

function defaultVerify(
  actionId: ExecAllowlistedAction,
  input: unknown,
  readBack: unknown,
): VerificationVerdict {
  return getExecVerifier(actionId)(input, readBack);
}

export interface ExecuteDecidedRunParams {
  clinicId: string;
  eventId: string;
  /** Decisão S2 gravada em `result.policy_decision` (server-derived, nunca input livre). */
  decision: ProposalPolicyDecision | null | undefined;
  /** Input canônico da Action (já validado pelo chamador contra o schema). */
  input: unknown;
  /** Contexto server-derived (tenant + RBAC + auditoria). */
  actionCtx: ActionContext;
}

export type ExecuteDecidedRunOutcome =
  | { executed: false; reason: string; receipt?: ExecutionReceipt | null }
  | { executed: true; receipt: ExecutionReceipt; outcome: ExecutionOutcome; persisted: boolean };

/**
 * Executa a run decidida (AUTO + allowlist) com verificação determinística.
 *
 * Ordem (fail-closed, sem retry cego em nenhum ponto):
 * modo ⇒ decisão/allowlist ⇒ receipt existente (replay ⇒ skip SEM re-executar)
 * ⇒ `runAction` ⇒ `unknown_effect` ⇒ `suspended` ⇒ releitura backend ⇒
 * verifier `ok` ⇒ `business_success` / `failed` / `unknown` ⇒ `suspended` ⇒
 * persiste receipt + outcome (reuso de `result` jsonb, sem migration).
 */
export async function executeDecidedRun(
  params: ExecuteDecidedRunParams,
  deps: AiControlExecutorDeps = {},
): Promise<ExecuteDecidedRunOutcome> {
  const { clinicId, eventId, decision, input, actionCtx } = params;
  if (!isNonEmptyString(clinicId) || !isNonEmptyString(eventId)) {
    return { executed: false, reason: 'invalid_params' };
  }

  // 1. Gate de modo — off/observe (e qualquer outro) dispensam SEM efeito e
  //    SEM escrita: nenhuma seam (load/run/verify/save) é tocada.
  const mode = deps.readMode ? deps.readMode() : readAiControlExecMode();
  if (!isAiControlExecEnabled(mode)) {
    return { executed: false, reason: 'mode_not_auto' };
  }

  // 2. Gate de decisão + allowlist — fora dela, NUNCA executa.
  const gate = canExecuteDecision(decision);
  if (!gate.executable) {
    return { executed: false, reason: gate.reason };
  }
  const actionId = (decision as ProposalPolicyDecision).action_id as ExecAllowlistedAction;

  // 3. Idempotência: verifica o receipt existente ANTES de executar — replay
  //    do mesmo run retorna o receipt sem re-executar nada.
  const loadRun = deps.loadRun ?? defaultLoadRun;
  const run = await loadRun(clinicId, eventId);
  const guard = shouldPersistExecution(run, clinicId);
  if (!guard.persist) {
    if (guard.reason === 'already_executed') {
      return { executed: false, reason: 'already_executed', receipt: getExecutionReceipt(run?.result) };
    }
    return { executed: false, reason: guard.reason };
  }

  const startedAt = Date.now();
  const idempotencyKey = buildExecutionIdempotencyKey(
    clinicId,
    eventId,
    actionId,
    (decision as ProposalPolicyDecision).policy_version,
  );
  const runAction = deps.runAction ?? defaultRunAction;
  const readBackFn = deps.readBack ?? defaultReadBack;
  const verify = deps.verify ?? defaultVerify;
  const saveExecution = deps.saveExecution ?? defaultSaveExecution;

  const finish = async (
    receiptBase: Omit<ExecutionReceipt, 'duration_ms'>,
    outcomeBase: Omit<ExecutionOutcome, 'duration_ms'>,
  ): Promise<ExecuteDecidedRunOutcome> => {
    const durationMs = Date.now() - startedAt;
    const receipt: ExecutionReceipt = { ...receiptBase, duration_ms: durationMs };
    const outcome: ExecutionOutcome = { ...outcomeBase, duration_ms: durationMs };
    const nextResult = mergeExecutionRecord(run?.result, receipt, outcome);
    const affected = await saveExecution(clinicId, eventId, nextResult);
    if (affected === 0) {
      // Corrida: outro escritor registrou entre load e save — o registro
      // existente prevalece; NÃO re-executa, NÃO sobrescreve.
      return { executed: false, reason: 'already_executed', receipt: getExecutionReceipt(run?.result) };
    }
    return { executed: true, receipt, outcome, persisted: true };
  };

  // 4. Execução via seam (mockada em testes — sem efeito real fora de testes).
  const exec = await runAction(actionId, input, actionCtx);

  // 5. Efeito desconhecido ⇒ `suspended` + reconciliação manual: SEM retry
  //    cego, SEM marcar sucesso, SEM releitura que mascare a incerteza.
  if (!exec.ok && exec.errorCode === 'unknown_effect') {
    return finish(
      {
        idempotency_key: idempotencyKey,
        action_id: actionId,
        policy_version: (decision as ProposalPolicyDecision).policy_version,
        exec_policy_version: AI_CONTROL_EXEC_POLICY_VERSION,
        attempt_id: exec.attemptId ?? null,
      },
      {
        status: 'suspended',
        evidence: {
          reason: 'unknown_effect',
          attempt_id: exec.attemptId ?? null,
          reconciliation: 'manual',
        },
      },
    );
  }

  if (!exec.ok) {
    return finish(
      {
        idempotency_key: idempotencyKey,
        action_id: actionId,
        policy_version: (decision as ProposalPolicyDecision).policy_version,
        exec_policy_version: AI_CONTROL_EXEC_POLICY_VERSION,
        attempt_id: exec.attemptId ?? null,
      },
      {
        status: 'failed',
        evidence: { reason: 'execution_failed', error_code: exec.errorCode ?? 'internal' },
      },
    );
  }

  // 6. Verificação determinística: o `ok` do run NÃO basta — a pós-condição
  //    é LIDA DO BACKEND e avaliada pelo verifier puro da Action.
  let readBackValue: unknown;
  try {
    readBackValue = await readBackFn(actionId, input, actionCtx);
  } catch {
    readBackValue = null;
  }
  const verdict = verify(actionId, input, readBackValue);
  if (verdict === 'ok') {
    return finish(
      {
        idempotency_key: idempotencyKey,
        action_id: actionId,
        policy_version: (decision as ProposalPolicyDecision).policy_version,
        exec_policy_version: AI_CONTROL_EXEC_POLICY_VERSION,
        attempt_id: exec.attemptId ?? null,
      },
      {
        status: 'business_success',
        evidence: { reason: 'postcondition_verified', verification: 'ok' },
      },
    );
  }
  if (verdict === 'unknown') {
    return finish(
      {
        idempotency_key: idempotencyKey,
        action_id: actionId,
        policy_version: (decision as ProposalPolicyDecision).policy_version,
        exec_policy_version: AI_CONTROL_EXEC_POLICY_VERSION,
        attempt_id: exec.attemptId ?? null,
      },
      {
        status: 'suspended',
        evidence: {
          reason: 'verification_unavailable',
          verification: 'unknown',
          reconciliation: 'manual',
        },
      },
    );
  }
  return finish(
    {
      idempotency_key: idempotencyKey,
      action_id: actionId,
      policy_version: (decision as ProposalPolicyDecision).policy_version,
      exec_policy_version: AI_CONTROL_EXEC_POLICY_VERSION,
      attempt_id: exec.attemptId ?? null,
    },
    {
      status: 'failed',
      evidence: { reason: 'postcondition_mismatch', verification: 'failed' },
    },
  );
}
