import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { actionLogs } from '@/lib/db/schema/audit';
import { dbLogger } from '@/lib/logger';

export interface ActionLogRecord {
  clinicId: string | null;
  principalType: string | null;
  actor: string;
  onBehalfOf?: string | null;
  actionName: string;
  module: string;
  inputRedacted: unknown;
  result: 'ok' | 'error';
  errorCode?: string | null;
  // S5 (ActionAttempt, expansão aditiva — todos nullable no DB):
  durationMs?: number | null;
  policyVersion?: string | null;
  decision?: string | null;
  /** Fingerprint do approval token (16 hex) — NUNCA o token cru. */
  approvalId?: string | null;
}

/**
 * E3 — tentativa de Action consequencial.
 *
 * Diferente de `writeActionLog` (best-effort, usada em caminhos SEM efeito —
 * denies, gates e Actions não consequenciais), os writers abaixo PROPAGAM a
 * falha: são o contrato fail-closed do efeito consequencial.
 */
export interface ActionAttemptRecord {
  clinicId: string | null;
  principalType: string | null;
  actor: string;
  onBehalfOf?: string | null;
  actionName: string;
  module: string;
  /** Metadata já sanitizada pela allowlist da Action (nunca input cru). */
  inputRedacted: unknown;
  policyVersion?: string | null;
  decision?: string | null;
}

export interface ActionAttemptFinalization {
  result: 'ok' | 'error';
  errorCode?: string | null;
  durationMs?: number | null;
  /** Fingerprint do token consumido, quando houver. */
  approvalId?: string | null;
}

/**
 * Persiste a tentativa INICIADA (linha com `result='started'`) ANTES de
 * qualquer efeito e devolve o id da linha. Falha propaga (fail-closed): o
 * `runAction` não executa o handler sem esta escrita.
 */
export async function beginActionAttempt(rec: ActionAttemptRecord): Promise<{ attemptId: string }> {
  const rows = await getDb().insert(actionLogs).values({
    clinicId: rec.clinicId, principalType: rec.principalType, actor: rec.actor,
    onBehalfOf: rec.onBehalfOf ?? null, actionName: rec.actionName, module: rec.module,
    inputRedacted: rec.inputRedacted as any,
    // 'started' = tentativa registrada, desfecho ainda desconhecido. Coluna
    // `result` é text livre (sem enum/CHECK) — não exige migração.
    result: 'started',
    errorCode: null, durationMs: null,
    policyVersion: rec.policyVersion ?? null, decision: rec.decision ?? null,
    approvalId: null,
  }).returning({ id: actionLogs.id });
  const attemptId = rows[0]?.id;
  if (!attemptId) throw new Error('action attempt write returned no id');
  return { attemptId };
}

/**
 * Finaliza a MESMA tentativa (UPDATE por id — nunca cria linha nova). Falha
 * propaga: o efeito já pode ter ocorrido e o desfecho precisa ficar
 * registrado; sem confirmação, o `runAction` devolve `unknown_effect`.
 */
export async function finalizeActionAttempt(attemptId: string, patch: ActionAttemptFinalization): Promise<void> {
  const rows = await getDb().update(actionLogs)
    .set({
      result: patch.result,
      errorCode: patch.errorCode ?? null,
      durationMs: patch.durationMs ?? null,
      approvalId: patch.approvalId ?? null,
    })
    .where(eq(actionLogs.id, attemptId))
    .returning({ id: actionLogs.id });
  if (rows.length === 0) throw new Error('action attempt finalization lost the row');
}

export async function writeActionLog(rec: ActionLogRecord): Promise<void> {
  try {
    await getDb().insert(actionLogs).values({
      clinicId: rec.clinicId, principalType: rec.principalType, actor: rec.actor,
      onBehalfOf: rec.onBehalfOf ?? null, actionName: rec.actionName, module: rec.module,
      inputRedacted: rec.inputRedacted as any, result: rec.result, errorCode: rec.errorCode ?? null,
      durationMs: rec.durationMs ?? null, policyVersion: rec.policyVersion ?? null,
      decision: rec.decision ?? null, approvalId: rec.approvalId ?? null,
    });
  } catch (err) {
    dbLogger.error('failed to write action_log', err, { actionName: rec.actionName });
  }
}

const SENSITIVE_AUDIT_KEYS = new Set([
  'address', 'authorization', 'birthdate', 'cpf', 'document', 'email', 'healthnotes',
  'medicalhistory', 'name', 'password', 'patient', 'patientname', 'phone', 'secret',
  'token', 'access_token', 'refresh_token',
]);

function redactAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactAuditValue).filter((item) => item !== undefined);
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_AUDIT_KEYS.has(key.toLowerCase()))
      .map(([key, nested]) => [key, redactAuditValue(nested)])
      .filter(([, nested]) => nested !== undefined),
  );
}

export function allowlistInput(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  return Object.fromEntries(
    allowed
      .filter((key) => key in source)
      .map((key) => [key, key.toLowerCase() === 'idempotencykey'
        ? hashIdempotencyKey(source[key])
        : redactAuditValue(source[key])]),
  );
}

/**
 * Chave de idempotência é atacante-controlável (até 128 chars livres) e pode
 * embutir PII/segredo (`cpf=...`). Nunca persistir o valor cru em auditoria:
 * grava só o fingerprint sha256 curto (16 hex, mesmo formato do fingerprint
 * de payload outbound) para correlação sem vazar conteúdo.
 */
function hashIdempotencyKey(value: unknown): unknown {
  if (typeof value !== 'string') return redactAuditValue(value);
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}
