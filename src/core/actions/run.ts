import type { ActionContext, ActionDefinition, ActionResult, ActionErrorCode } from './types';
import { ActionError } from './types';
import { allowlistInput, beginActionAttempt, finalizeActionAttempt, writeActionLog } from './audit-writer';
import {
  APPROVAL_POLICY_VERSION, consumeApprovalToken, evaluatePolicy, hashActionInput,
} from './approval';
import { dbLogger } from '@/lib/logger';

function fail(code: ActionErrorCode, message: string) {
  return { ok: false as const, error: { code, message } };
}

/** Resultado explícito do estado desconhecido (E3) — sempre com a referência da tentativa. */
function unknownEffectResult(attemptId: string) {
  return {
    ok: false as const,
    error: {
      code: 'unknown_effect' as const,
      message: 'Resultado não confirmado; verifique antes de reenviar.',
      attemptId,
    },
  };
}

export async function runAction<O>(
  action: ActionDefinition<any, O>,
  rawInput: unknown,
  ctx: ActionContext,
): Promise<ActionResult<O>> {
  const startedAt = Date.now();
  // 1. Auth por principal — deny: sem input (atacante-controlável) no log
  if (!ctx || !ctx.clinicId || (ctx.source !== 'system' && !ctx.user)) {
    await writeActionLog({
      clinicId: ctx?.clinicId ?? null, principalType: ctx?.source ?? null,
      actor: ctx?.audit?.actor ?? 'unknown', onBehalfOf: ctx?.audit?.onBehalfOf,
      actionName: action.name, module: action.module,
      inputRedacted: {},
      result: 'error', errorCode: 'unauthenticated',
      durationMs: Date.now() - startedAt, policyVersion: APPROVAL_POLICY_VERSION, decision: 'deny',
    });
    return fail('unauthenticated', 'Não autenticado.');
  }

  // inputRedacted só em paths permitidos (allow). Deny (gates 2–4) loga
  // apenas {action, source, code} — nunca o input bruto, que pode embutir
  // PII/segredo em campos atacante-controláveis (ex.: idempotencyKey).
  // Tokens de aprovação NUNCA entram em log (nem cru nem fingerprint do
  // request — só o approvalId retornado pelo consumo, que é fingerprint).
  const denyBase = {
    clinicId: ctx.clinicId, principalType: ctx.source, actor: ctx.audit.actor,
    onBehalfOf: ctx.audit.onBehalfOf, actionName: action.name, module: action.module,
    inputRedacted: {} as Record<string, unknown>,
    policyVersion: APPROVAL_POLICY_VERSION,
  };
  const base = {
    ...denyBase,
    inputRedacted: allowlistInput(rawInput, action.auditFields ?? []),
  };
  const logDeny = (code: ActionErrorCode, decision = 'deny') =>
    writeActionLog({
      ...denyBase, result: 'error', errorCode: code, decision,
      durationMs: Date.now() - startedAt,
    });
  const logErr = (code: ActionErrorCode, extra: Record<string, unknown> = {}) =>
    writeActionLog({
      ...base, result: 'error', errorCode: code, decision: 'allow',
      durationMs: Date.now() - startedAt, ...extra,
    });

  // 2. Gate manifesto
  if (!ctx.hasModule(action.module)) { await logDeny('module_disabled'); return fail('module_disabled', 'Módulo não disponível.'); }
  // 3. Gate RBAC
  if (!ctx.can(action.requires)) { await logDeny('forbidden'); return fail('forbidden', 'Sem permissão.'); }
  // 3b. Gate de política (determinístico, puro).
  const policy = evaluatePolicy(action, ctx);
  if (policy.decision === 'deny') {
    // E3 — DENY ABSOLUTO: recusa ANTES do handler e ANTES de qualquer consumo
    // de token. Token válido não eleva (decisão humana vinculante); a negação
    // mais restritiva vence e não gera nenhuma chamada externa.
    await logDeny('forbidden', 'deny');
    return fail('forbidden', 'Sem permissão.');
  }
  const approvalGate = policy.decision === 'approval_required';

  // 4. Tenant selector guard — reject untrusted clinicId/clinic_id before Zod strips it
  const rejectTenantSelector = async () => {
    await logDeny('invalid_input', approvalGate ? 'approval_required' : undefined);
    return fail('invalid_input', 'Dados inválidos.');
  };
  if (rawInput !== null && typeof rawInput === 'object' && !Array.isArray(rawInput)) {
    const hasClinicId = Object.prototype.hasOwnProperty.call(rawInput as Record<string, unknown>, 'clinicId');
    const hasClinicIdSnake = Object.prototype.hasOwnProperty.call(rawInput as Record<string, unknown>, 'clinic_id');
    if (hasClinicId || hasClinicIdSnake) return rejectTenantSelector();
  }

  // 4b. Input canônico (pós-Zod) — o hash do token amarra no parsing estabelecido.
  const parsed = action.input.safeParse(rawInput);
  if (!parsed.success) {
    await logDeny('invalid_input', approvalGate ? 'approval_required' : undefined);
    return fail('invalid_input', 'Dados inválidos.');
  }

  // E3 — tentativa consequencial: registro ANTES do efeito.
  // Ordem deliberada: a escrita vem ANTES do consumo do token, para que uma
  // falha de auditoria não gaste uma aprovação sem executar (risco conhecido
  // e documentado — nunca retry cego, e o consumo é single-use).
  const beginAttempt = async (decision: string): Promise<string | null> => {
    try {
      const { attemptId } = await beginActionAttempt({
        clinicId: ctx.clinicId, principalType: ctx.source, actor: ctx.audit.actor,
        onBehalfOf: ctx.audit.onBehalfOf, actionName: action.name, module: action.module,
        inputRedacted: base.inputRedacted,
        policyVersion: APPROVAL_POLICY_VERSION, decision,
      });
      return attemptId;
    } catch (err) {
      dbLogger.error('action attempt write failed — fail-closed, effect not executed', err, { action: action.name });
      return null;
    }
  };

  const execute = async (
    attemptId: string | null,
    decision: string,
    approvalId: string | null,
  ): Promise<ActionResult<O>> => {
    try {
      const data = await action.handler(parsed.data, ctx);
      if (attemptId) {
        try {
          await finalizeActionAttempt(attemptId, {
            result: 'ok', durationMs: Date.now() - startedAt, approvalId,
          });
        } catch (err) {
          // Efeito aplicado, finalização falhou: o desfecho NÃO pode ser
          // afirmado. Devolve estado desconhecido com a referência da tentativa
          // e sem retry automático (reenviar poderia duplicar o efeito).
          dbLogger.error('action attempt finalization failed after effect', err, { action: action.name });
          return unknownEffectResult(attemptId);
        }
        return { ok: true, data };
      }
      await writeActionLog({
        ...base, result: 'ok', errorCode: null, decision, approvalId,
        durationMs: Date.now() - startedAt,
      });
      return { ok: true, data };
    } catch (err) {
      const code: ActionErrorCode = err instanceof ActionError ? err.code : 'internal';
      if (code === 'internal') dbLogger.error('action handler threw', err, { action: action.name });
      if (attemptId) {
        try {
          await finalizeActionAttempt(attemptId, {
            result: 'error', errorCode: code, durationMs: Date.now() - startedAt, approvalId,
          });
        } catch (auditErr) {
          // Erro do handler e erro de auditoria ficam separados: sem
          // finalização não se pode afirmar o estado do efeito (a falha pode
          // ser posterior a um efeito parcial). Também sem retry automático.
          dbLogger.error('action attempt finalization failed after handler error', auditErr, { action: action.name });
          return unknownEffectResult(attemptId);
        }
        return fail(code, err instanceof ActionError ? err.message : 'Erro interno.');
      }
      await logErr(code, { decision, approvalId });
      return fail(code, err instanceof ActionError ? err.message : 'Erro interno.');
    }
  };

  const consequential = action.consequential === true;
  /**
   * Inicia a tentativa (Actions consequenciais) ou devolve a recusa
   * fail-closed já pronta. Fora do caminho consequencial não há tentativa —
   * o contrato de efeito desconhecido não se aplica (nada a reconciliar).
   */
  const beginOrRefuse = async (
    decision: string,
  ): Promise<{ attemptId: string | null } | { refuse: ActionResult<O> }> => {
    if (!consequential) return { attemptId: null };
    const attemptId = await beginAttempt(decision);
    if (!attemptId) return { refuse: fail('audit_incomplete', 'Auditoria indisponível; ação não executada.') };
    return { attemptId };
  };

  if (approvalGate) {
    const begun = await beginOrRefuse('approval_required');
    if ('refuse' in begun) return begun.refuse;
    const attemptId = begun.attemptId;
    // Somente identidade derivada pelo servidor (context builders) — nunca
    // campo do input do chamador (clinicId do input já foi rejeitado acima).
    const consumed = await consumeApprovalToken(ctx.approvalToken ?? '', {
      actionName: action.name,
      inputHash: hashActionInput(parsed.data),
      clinicId: ctx.clinicId,
      actor: ctx.audit.actor,
      source: ctx.source,
      userId: ctx.user?.id ?? null,
      onBehalfOf: ctx.audit.onBehalfOf ?? null,
    });
    if (!consumed.ok) {
      // Handler não executou: finaliza a tentativa como erro (best-effort —
      // falha de log aqui não muda o veredito forbid).
      if (attemptId) {
        try {
          await finalizeActionAttempt(attemptId, {
            result: 'error', errorCode: 'forbidden', durationMs: Date.now() - startedAt,
          });
        } catch { /* veredito já é forbidden; auditoria incompleta sem efeito */ }
      } else {
        await logDeny('forbidden', 'approval_required');
      }
      return fail('forbidden', 'Sem permissão.');
    }
    return execute(attemptId, 'approval_required', consumed.approvalId ?? null);
  }

  const begun = await beginOrRefuse('allow');
  if ('refuse' in begun) return begun.refuse;
  return execute(begun.attemptId, 'allow', null);
}
