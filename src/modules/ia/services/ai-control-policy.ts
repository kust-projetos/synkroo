/**
 * P4 Slice 2 — hookup de política: proposta OBSERVE → decisão determinística.
 *
 * Associa a proposta materializada em `agent_runs.result` (`{ next_step }` +
 * `action` opcional) a uma Action do catálogo do bootstrap e produz uma
 * `ProposalPolicyDecision` pura, determinística e versionada — ainda SEM
 * executar nenhuma Action (este módulo NÃO importa o executor de Actions,
 * executores, LLM, RAG nem serviços de envio; coberto por teste estático).
 *
 * Persistência: a decisão é gravada em `result.policy_decision` (reuso da
 * coluna `result` jsonb — nenhuma migration neste slice) via UPDATE
 * condicional (`status = 'observed'` + `result` sem decisão prévia).
 * Replay é idempotente: a segunda chamada detecta a decisão já gravada e não
 * escreve (0 writes). Tenant é cercado por `(clinic_id, event_id)` em todas
 * as leituras/escritas.
 */
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { getAction } from '@/core/actions/registry';
import { agentRuns } from '@/modules/ia/schema/observe';

/** Versão da política deste slice — gravada em cada decisão (auditoria). */
export const AI_CONTROL_POLICY_VERSION = 'p4-s2-policy-v1' as const;

/** Modo OBSERVE suportado por este slice (qualquer outro → DENY). */
export const AI_CONTROL_POLICY_OBSERVE_MODE = 'observe' as const;

export type ProposalPolicyVerdict = 'AUTO' | 'CONFIRM' | 'APPROVAL' | 'DENY';

export interface ProposalPolicyProposal {
  next_step: unknown;
  /** Nome da Action candidata — só vale se existir no catálogo (nunca string livre). */
  action?: unknown;
}

export interface ProposalPolicyContext {
  mode: unknown;
  /** RBAC do solicitante (server-derived). Ausente/não-função → DENY. */
  can: (permissionKey: string) => boolean;
  /** Módulo ativo (server-derived). Ausente/não-função → DENY. */
  hasModule: (moduleId: string) => boolean;
}

export interface ProposalPolicyDecision {
  decision: ProposalPolicyVerdict;
  /** Classe de risco resolvida (`unknown` quando a Action sequer existe). */
  riskClass: string;
  reason: string;
  policy_version: typeof AI_CONTROL_POLICY_VERSION;
  /** Nome da Action do catálogo, ou `null` (nunca string livre). */
  action_id: string | null;
}

/** Subconjunto do catálogo necessário à decisão (sem handler, sem input). */
export interface PolicyCatalogEntry {
  name: string;
  module: string;
  requires: string;
  riskClass?: string;
  consequential?: boolean;
}

export interface EvaluateProposalPolicyDeps {
  /** Lookup no catálogo (default: registry do bootstrap). Injetável p/ testes. */
  lookup?: (name: string) => PolicyCatalogEntry | null | undefined;
}

const KNOWN_RISK_CLASSES = new Set(['standard', 'deny_non_human', 'approval']);

function defaultLookup(name: string): PolicyCatalogEntry | null {
  const found = getAction(name);
  if (!found) return null;
  return {
    name: found.name,
    module: found.module,
    requires: found.requires,
    riskClass: found.riskClass,
    consequential: found.consequential,
  };
}

function deny(
  reason: string,
  action_id: string | null = null,
  riskClass = 'unknown',
): ProposalPolicyDecision {
  return {
    decision: 'DENY',
    riskClass,
    reason,
    policy_version: AI_CONTROL_POLICY_VERSION,
    action_id,
  };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Decisão de política pura (sem I/O, sem relógio, sem aleatoriedade):
 * mesmo input ⇒ mesma decisão, sempre.
 *
 * Ordem determinística (a negação mais restritiva vence):
 * proposta inválida → sem action → action desconhecida → classe de risco
 * desconhecida → `deny_non_human` ABSOLUTO (token nunca eleva: esta função
 * sequer aceita token) → contexto ausente → modo ≠ observe → módulo
 * desabilitado → sem RBAC → `approval` ⇒ APPROVAL → consequencial ⇒
 * CONFIRM → demais `standard` ⇒ AUTO.
 */
export function evaluateProposalPolicy(
  proposal: ProposalPolicyProposal | null | undefined,
  ctx: ProposalPolicyContext | null | undefined,
  deps: EvaluateProposalPolicyDeps = {},
): ProposalPolicyDecision {
  if (!proposal || typeof proposal !== 'object' || !isNonEmptyString(proposal.next_step)) {
    return deny('invalid_proposal');
  }
  const actionName = proposal.action;
  if (!isNonEmptyString(actionName)) {
    return deny('no_action_proposed');
  }
  const lookup = deps.lookup ?? defaultLookup;
  const entry = lookup(actionName);
  if (!entry || typeof entry !== 'object' || !isNonEmptyString(entry.name)) {
    return deny('unknown_action');
  }
  // Vincula SOMENTE a Action do catálogo — `action_id` nunca é string livre:
  // ou é o nome validado no lookup, ou `null`.
  const actionId = entry.name;
  const riskClass = entry.riskClass ?? 'standard';
  if (!KNOWN_RISK_CLASSES.has(riskClass)) {
    return deny('unknown_risk_class', actionId, riskClass);
  }
  // DENY ABSOLUTO: principal deste slice é o agente (não-humano); aprovação
  // humana vinculante nunca é elevada — sem parâmetro de token por desenho.
  if (riskClass === 'deny_non_human') {
    return deny('deny_non_human_absolute', actionId, riskClass);
  }
  if (
    !ctx
    || typeof ctx !== 'object'
    || typeof (ctx as ProposalPolicyContext).can !== 'function'
    || typeof (ctx as ProposalPolicyContext).hasModule !== 'function'
  ) {
    return deny('missing_policy_context', actionId, riskClass);
  }
  if (ctx.mode !== AI_CONTROL_POLICY_OBSERVE_MODE) {
    return deny('mode_not_observe', actionId, riskClass);
  }
  let moduleOn = false;
  let allowed = false;
  try {
    moduleOn = ctx.hasModule(entry.module) === true;
    allowed = ctx.can(entry.requires) === true;
  } catch {
    // Fail-closed: predicado quebrou → nega sem vazar o erro.
    return deny('policy_context_error', actionId, riskClass);
  }
  if (!moduleOn) {
    return deny('module_disabled', actionId, riskClass);
  }
  if (!allowed) {
    return deny('forbidden', actionId, riskClass);
  }
  if (riskClass === 'approval') {
    return {
      decision: 'APPROVAL',
      riskClass,
      reason: 'approval_required',
      policy_version: AI_CONTROL_POLICY_VERSION,
      action_id: actionId,
    };
  }
  if (entry.consequential === true) {
    return {
      decision: 'CONFIRM',
      riskClass,
      reason: 'confirm_consequential',
      policy_version: AI_CONTROL_POLICY_VERSION,
      action_id: actionId,
    };
  }
  return {
    decision: 'AUTO',
    riskClass,
    reason: 'auto_standard',
    policy_version: AI_CONTROL_POLICY_VERSION,
    action_id: actionId,
  };
}

/** Chave jsonb sob a qual a decisão vive dentro de `agent_runs.result`. */
export const POLICY_DECISION_RESULT_KEY = 'policy_decision' as const;

export function hasPolicyDecision(result: unknown): boolean {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) return false;
  const key = POLICY_DECISION_RESULT_KEY;
  return (
    Object.prototype.hasOwnProperty.call(result, key)
    && (result as Record<string, unknown>)[key] !== undefined
    && (result as Record<string, unknown>)[key] !== null
  );
}

export function mergePolicyDecision(
  result: unknown,
  decision: ProposalPolicyDecision,
): Record<string, unknown> {
  const base =
    typeof result === 'object' && result !== null && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : {};
  return { ...base, [POLICY_DECISION_RESULT_KEY]: { ...decision } };
}

export interface PolicyRunSnapshot {
  clinicId: string;
  status: string;
  result: unknown;
}

/**
 * Guarda pura da persistência: só persiste quando a run está `observed`,
 * pertence ao tenant esperado e ainda não carrega decisão. Determinística.
 */
export function shouldPersistPolicyDecision(
  run: PolicyRunSnapshot | null | undefined,
  clinicId: string,
): { persist: boolean; reason: string } {
  if (!run || typeof run !== 'object') return { persist: false, reason: 'run_missing' };
  if (run.clinicId !== clinicId) return { persist: false, reason: 'tenant_mismatch' };
  if (run.status !== 'observed') return { persist: false, reason: 'status_not_observed' };
  if (hasPolicyDecision(run.result)) return { persist: false, reason: 'already_decided' };
  return { persist: true, reason: 'ok' };
}

export interface PolicyDecisionStore {
  loadRun: (clinicId: string, eventId: string) => Promise<PolicyRunSnapshot | null>;
  /** UPDATE condicional; devolve linhas afetadas (0 = replay/skipped no DB). */
  saveDecision: (
    clinicId: string,
    eventId: string,
    nextResult: Record<string, unknown>,
  ) => Promise<number>;
}

async function defaultLoadRun(clinicId: string, eventId: string): Promise<PolicyRunSnapshot | null> {
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

async function defaultSaveDecision(
  clinicId: string,
  eventId: string,
  nextResult: Record<string, unknown>,
): Promise<number> {
  // UPDATE idempotente no DB: só promove `observed` sem decisão. A guarda
  // `shouldPersistPolicyDecision` já barrou replay em memória; este
  // predicado fecha a corrida (dois escritores gravam a mesma decisão
  // determinística; o segundo casa 0 linhas).
  const updated = await getDb()
    .update(agentRuns)
    .set({ result: nextResult, updatedAt: new Date() })
    .where(and(
      eq(agentRuns.clinicId, clinicId),
      eq(agentRuns.eventId, eventId),
      eq(agentRuns.status, 'observed'),
    ))
    .returning({ id: agentRuns.id });
  return updated.length;
}

export const defaultPolicyDecisionStore: PolicyDecisionStore = {
  loadRun: defaultLoadRun,
  saveDecision: defaultSaveDecision,
};

export interface PersistPolicyDecisionParams {
  clinicId: string;
  eventId: string;
  decision: ProposalPolicyDecision;
}

export interface PersistPolicyDecisionOutcome {
  updated: boolean;
  reason: string;
}

/**
 * Persiste a decisão em `result.policy_decision` (reuso da coluna `result`
 * jsonb — sem migration). Idempotente: run ausente/tenant divergente/não
 * `observed`/já decidida ⇒ `updated: false`, sem escrita. Replay não duplica.
 */
export async function persistPolicyDecision(
  params: PersistPolicyDecisionParams,
  store: PolicyDecisionStore = defaultPolicyDecisionStore,
): Promise<PersistPolicyDecisionOutcome> {
  const { clinicId, eventId, decision } = params;
  if (!isNonEmptyString(clinicId) || !isNonEmptyString(eventId) || !decision) {
    return { updated: false, reason: 'invalid_params' };
  }
  const run = await store.loadRun(clinicId, eventId);
  const guard = shouldPersistPolicyDecision(run, clinicId);
  if (!guard.persist) {
    return { updated: false, reason: guard.reason };
  }
  const nextResult = mergePolicyDecision(run?.result, decision);
  const affected = await store.saveDecision(clinicId, eventId, nextResult);
  if (affected === 0) {
    // Corrida: outro escritor decidiu entre load e save (mesma decisão
    // determinística) — trata como já-decidido, sem erro.
    return { updated: false, reason: 'already_decided' };
  }
  return { updated: true, reason: 'ok' };
}
