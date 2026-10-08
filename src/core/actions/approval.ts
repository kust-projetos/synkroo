import { createHash, randomBytes } from 'crypto';

/**
 * S5 — Approval token opaco server-side (single-use, TTL, amarrado).
 *
 * - Token opaco: 32 bytes aleatórios (hex). O servidor guarda SÓ o
 *   fingerprint sha256 do token — nunca o token em log ou em tabela.
 * - Amarração: actionName + inputHash (sha256 do input canônico pós-Zod) +
 *   clinicId + actor + source + identidade server-derived (userId/onBehalfOf).
 *   Token não vale para input distinto, outro principal/clínica/ação, nem
 *   para outro usuário autenticado/delegante — mesmo com actor/clínica iguais.
 * - Uso único: validar+consumir é atômico (consumo marca; replay falha).
 * - TTL default conservador: 15 min.
 *
 * Store default é em memória (server-side, single-instance). É o menor passo
 * defensável: não afrouxa nenhum gate e não exige infra nova. Limitação
 * conhecida: em multi-instância seria preciso persistir em tabela/DO — ver
 * RISKS no relatório da tarefa.
 */

export const APPROVAL_POLICY_VERSION = 's5-approval-v1';
export const APPROVAL_TTL_MS_DEFAULT = 15 * 60 * 1000;

export type PolicyVerdict = 'allow' | 'deny' | 'approval_required';

export interface PolicyDecision {
  decision: PolicyVerdict;
  reason: string;
}

interface ApprovalRecord {
  tokenHash: string;
  actionName: string;
  inputHash: string;
  clinicId: string;
  actor: string;
  source: string;
  /** Identidade autenticada/delegante derivada pelo servidor (ctx.user.id). */
  userId: string | null;
  /** Delegante server-derived (ctx.audit.onBehalfOf). Null quando não há. */
  onBehalfOf: string | null;
  expiresAt: number;
  consumedAt: number | null;
}

const store = new Map<string, ApprovalRecord>();

export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

/** sha256 hex do input canônico (pós-Zod). */
export function hashActionInput(input: unknown): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex');
}

/** Fingerprint público do token — o ÚNICO que pode ir para log/coluna approval_id. */
export function fingerprintApprovalToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface IssueApprovalOptions {
  ttlMs?: number;
  now?: number;
}

export interface IssuedApproval {
  /** Token opaco — entregar ao solicitante UMA vez; nunca logar. */
  token: string;
  expiresAt: number;
}

export function issueApprovalToken(params: {
  actionName: string;
  /** Input canônico (ideal: parsed.data pós-Zod). É hasheado; o cru nunca é guardado. */
  input: unknown;
  clinicId: string;
  actor: string;
  source: string;
  /** Somente identidade derivada pelo servidor (ctx.user?.id). Nunca input do chamador. */
  userId?: string | null;
  /** Somente delegante derivado pelo servidor (ctx.audit.onBehalfOf). */
  onBehalfOf?: string | null;
}, opts: IssueApprovalOptions = {}): IssuedApproval {
  const now = opts.now ?? Date.now();
  const ttlMs = opts.ttlMs ?? APPROVAL_TTL_MS_DEFAULT;
  const token = randomBytes(32).toString('hex');
  const expiresAt = now + ttlMs;
  const rec: ApprovalRecord = {
    tokenHash: hashToken(token),
    actionName: params.actionName,
    inputHash: hashActionInput(params.input),
    clinicId: params.clinicId,
    actor: params.actor,
    source: params.source,
    userId: params.userId ?? null,
    onBehalfOf: params.onBehalfOf ?? null,
    expiresAt,
    consumedAt: null,
  };
  store.set(rec.tokenHash, rec);
  return { token, expiresAt };
}

export interface ConsumeApprovalExpectation {
  actionName: string;
  /** Hash do input canônico da chamada atual (hashActionInput(parsed.data)). */
  inputHash: string;
  clinicId: string;
  actor: string;
  source: string;
  /** Somente identidade derivada pelo servidor (ctx.user?.id). */
  userId?: string | null;
  /** Somente delegante derivado pelo servidor (ctx.audit.onBehalfOf). */
  onBehalfOf?: string | null;
}

export interface ConsumeApprovalResult {
  ok: boolean;
  reason?: 'not_found' | 'consumed' | 'expired' | 'mismatch';
  /** Fingerprint para auditoria (approval_id). Nunca o token. */
  approvalId?: string;
}

export function consumeApprovalToken(
  token: string,
  expected: ConsumeApprovalExpectation,
  opts: { now?: number } = {},
): ConsumeApprovalResult {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'not_found' };
  const now = opts.now ?? Date.now();
  const key = hashToken(token);
  const rec = store.get(key);
  if (!rec) return { ok: false, reason: 'not_found' };
  if (rec.consumedAt !== null) return { ok: false, reason: 'consumed' };
  if (now >= rec.expiresAt) {
    store.delete(key);
    return { ok: false, reason: 'expired' };
  }
  if (
    rec.actionName !== expected.actionName ||
    rec.inputHash !== expected.inputHash ||
    rec.clinicId !== expected.clinicId ||
    rec.actor !== expected.actor ||
    rec.source !== expected.source ||
    rec.userId !== (expected.userId ?? null) ||
    rec.onBehalfOf !== (expected.onBehalfOf ?? null)
  ) {
    return { ok: false, reason: 'mismatch' };
  }
  rec.consumedAt = now;
  return { ok: true, approvalId: fingerprintApprovalToken(token) };
}

/**
 * Decisão de política (pura, sem I/O): ações standard/user → allow;
 * deny_non_human com source !== 'user' → approval_required (o runAction
 * então exige token válido; sem token continua forbidden — deny-by-default).
 * 'deny' reservado para endurecimentos futuros.
 */
export function evaluatePolicy(action: { riskClass?: string }, ctx: { source: string }): PolicyDecision {
  if (action.riskClass === 'deny_non_human' && ctx.source !== 'user') {
    return { decision: 'approval_required', reason: 'deny_non_human requires human approval token' };
  }
  return { decision: 'allow', reason: 'no approval gate applies' };
}

/** Apenas para testes — limpa o store em memória. */
export function clearApprovalTokensForTests(): void {
  store.clear();
}
