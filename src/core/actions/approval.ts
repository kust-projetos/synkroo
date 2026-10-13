import { createHash, randomBytes } from 'crypto';
import { and, eq, gt, isNull, lte } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { approvalTokens } from '@/lib/db/schema/audit';

/**
 * S5 — Approval token opaco server-side (single-use, TTL, amarrado).
 *
 * - Token opaco: 32 bytes aleatórios (hex). O servidor guarda SÓ o
 *   fingerprint sha256 do token — nunca o token em log ou em tabela.
 * - Amarração: actionName + inputHash (sha256 do input canônico pós-Zod) +
 *   clinicId + actor + source + identidade server-derived (userId/onBehalfOf).
 *   Token não vale para input distinto, outro principal/clínica/ação, nem
 *   para outro usuário autenticado/delegante — mesmo com actor/clínica iguais.
 * - Uso único: validar+consumir é atômico — o consumo é um
 *   `UPDATE ... WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now`
 *   e só a primeira instância a comitar recebe linha (rowCount 1). Replay em
 *   qualquer instância falha (fail-closed).
 * - TTL default conservador: 15 min.
 *
 * Store é a tabela `approval_tokens` (S5-PERSIST) — sobrevive a restart e é
 * visível a todas as instâncias. Se o DB estiver indisponível, issue lança
 * (sem persistência não há token) e consume nega — fail-closed, nunca allow.
 * Expirados são removidos por lazy purge no consumo (escolha documentada:
 * tabela efêmera de TTL curto; sem job dedicado).
 */

export const APPROVAL_POLICY_VERSION = 's5-approval-v1';
export const APPROVAL_TTL_MS_DEFAULT = 15 * 60 * 1000;

export type PolicyVerdict = 'allow' | 'deny' | 'approval_required';

export interface PolicyDecision {
  decision: PolicyVerdict;
  reason: string;
}

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

export async function issueApprovalToken(params: {
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
}, opts: IssueApprovalOptions = {}): Promise<IssuedApproval> {
  const now = opts.now ?? Date.now();
  const ttlMs = opts.ttlMs ?? APPROVAL_TTL_MS_DEFAULT;
  // E1: hex manual — evita `Buffer.toString(encoding)`, cujo tipo colide com
  // `@cloudflare/workers-types` (Buffer: any) no programa ia-bridge (TS2554).
  // Semântica byte-idêntica: 32 bytes aleatórios → 64 chars hex lowercase.
  const token = Array.from(randomBytes(32) as Uint8Array)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');
  const expiresAt = now + ttlMs;
  try {
    await getDb().insert(approvalTokens).values({
      tokenHash: hashToken(token),
      action: params.actionName,
      inputHash: hashActionInput(params.input),
      clinicId: params.clinicId,
      actor: params.actor,
      source: params.source,
      userId: params.userId ?? null,
      onBehalfOf: params.onBehalfOf ?? null,
      expiresAt: new Date(expiresAt),
    });
  } catch {
    // Fail-closed: sem persistência não há token (e sem token o runAction nega).
    throw new Error('approval store unavailable');
  }
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

export async function consumeApprovalToken(
  token: string,
  expected: ConsumeApprovalExpectation,
  opts: { now?: number } = {},
): Promise<ConsumeApprovalResult> {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'not_found' };
  const now = opts.now ?? Date.now();
  const key = hashToken(token);
  let rows: (typeof approvalTokens.$inferSelect)[];
  try {
    const db = getDb();
    // Select ANTES do purge: token já expirado retorna 'expired' (determinístico)
    // em vez de 'not_found'. O purge lazy abaixo impede acúmulo de expirados.
    rows = await db.select().from(approvalTokens).where(eq(approvalTokens.tokenHash, key));
    // Lazy purge de expirados (tabela efêmera — não acumula).
    await db.delete(approvalTokens).where(lte(approvalTokens.expiresAt, new Date(now)));
  } catch {
    // Fail-closed: DB indisponível → nunca allow.
    return { ok: false, reason: 'not_found' };
  }
  const rec = rows[0];
  if (!rec) return { ok: false, reason: 'not_found' };
  if (rec.consumedAt !== null) return { ok: false, reason: 'consumed' };
  if (now >= rec.expiresAt.getTime()) {
    try {
      await getDb().delete(approvalTokens).where(eq(approvalTokens.tokenHash, key));
    } catch {
      // Purge best-effort; o veredito já é expired.
    }
    return { ok: false, reason: 'expired' };
  }
  if (
    rec.action !== expected.actionName ||
    rec.inputHash !== expected.inputHash ||
    rec.clinicId !== expected.clinicId ||
    rec.actor !== expected.actor ||
    rec.source !== expected.source ||
    (rec.userId ?? null) !== (expected.userId ?? null) ||
    (rec.onBehalfOf ?? null) !== (expected.onBehalfOf ?? null)
  ) {
    return { ok: false, reason: 'mismatch' };
  }
  try {
    // Consumo atômico single-use: só a primeira instância recebe linha.
    const updated = await getDb().update(approvalTokens)
      .set({ consumedAt: new Date(now) })
      .where(and(
        eq(approvalTokens.tokenHash, key),
        isNull(approvalTokens.consumedAt),
        gt(approvalTokens.expiresAt, new Date(now)),
      ))
      .returning({ tokenHash: approvalTokens.tokenHash });
    if (updated.length === 0) {
      // Corrida entre instâncias (ou expiração entre select e update).
      return now >= rec.expiresAt.getTime()
        ? { ok: false, reason: 'expired' }
        : { ok: false, reason: 'consumed' };
    }
  } catch {
    // Fail-closed: sem confirmação de consumo, nega.
    return { ok: false, reason: 'not_found' };
  }
  return { ok: true, approvalId: fingerprintApprovalToken(token) };
}

/**
 * Decisão de política (pura, sem I/O).
 *
 * E3 — decisão humana vinculante: `deny_non_human` com principal não-humano
 * (`source !== 'user'`) é DENY ABSOLUTO. Approval token NUNCA eleva esse
 * veredito; o `runAction` recusa antes do handler e antes de consumir token
 * (zero chamadas ao handler e ao consume). `approval_required` existe apenas
 * para a classe APPROVAL explícita (`riskClass: 'approval'`) — nenhuma Action
 * de produção a usa hoje, e nada foi reclassificado automaticamente.
 */
export function evaluatePolicy(action: { riskClass?: string }, ctx: { source: string }): PolicyDecision {
  if (ctx.source !== 'user') {
    if (action.riskClass === 'deny_non_human') {
      return {
        decision: 'deny',
        reason: 'deny_non_human: absolute deny for non-human principals (approval never elevates)',
      };
    }
    if (action.riskClass === 'approval') {
      return { decision: 'approval_required', reason: 'approval class requires a valid human approval token' };
    }
  }
  return { decision: 'allow', reason: 'no approval gate applies' };
}

/** Apenas para testes — purga a tabela (best-effort; no-op com DB mockado). */
export async function clearApprovalTokensForTests(): Promise<void> {
  try {
    await getDb().delete(approvalTokens);
  } catch {
    // Testes com DB mockado: nada a purgar.
  }
}
