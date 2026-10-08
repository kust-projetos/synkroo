import type { ActionContext, ActionDefinition, ActionResult, ActionErrorCode } from './types';
import { ActionError } from './types';
import { allowlistInput, writeActionLog } from './audit-writer';
import {
  APPROVAL_POLICY_VERSION, consumeApprovalToken, evaluatePolicy, hashActionInput,
} from './approval';
import { dbLogger } from '@/lib/logger';

function fail(code: ActionErrorCode, message: string) {
  return { ok: false as const, error: { code, message } };
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
  // 3b. Gate de classe de risco (S5): 'deny_non_human' com source !== 'user'
  // exige approval token válido single-use amarrado a action+input-hash+
  // principal (via humana). Sem token válido continua 'forbidden'
  // (deny-by-default — nunca afrouxa).
  const policy = evaluatePolicy(action, ctx);
  if (policy.decision === 'approval_required') {
    // Parse canônico ANTES do token (amarra inputHash ao parsed pós-Zod).
    if (rawInput !== null && typeof rawInput === 'object' && !Array.isArray(rawInput)) {
      const hasClinicId = Object.prototype.hasOwnProperty.call(rawInput as Record<string, unknown>, 'clinicId');
      const hasClinicIdSnake = Object.prototype.hasOwnProperty.call(rawInput as Record<string, unknown>, 'clinic_id');
      if (hasClinicId || hasClinicIdSnake) {
        await logDeny('invalid_input', 'approval_required');
        return fail('invalid_input', 'Dados inválidos.');
      }
    }
    const parsed = action.input.safeParse(rawInput);
    if (!parsed.success) { await logDeny('invalid_input', 'approval_required'); return fail('invalid_input', 'Dados inválidos.'); }
    const consumed = await consumeApprovalToken(ctx.approvalToken ?? '', {
      actionName: action.name,
      inputHash: hashActionInput(parsed.data),
      clinicId: ctx.clinicId,
      actor: ctx.audit.actor,
      source: ctx.source,
      // Somente identidade derivada pelo servidor (context builders) —
      // nunca campo do input do chamador (rawInput já teve clinicId rejeitado).
      userId: ctx.user?.id ?? null,
      onBehalfOf: ctx.audit.onBehalfOf ?? null,
    });
    if (!consumed.ok) {
      await logDeny('forbidden', 'approval_required');
      return fail('forbidden', 'Sem permissão.');
    }
    try {
      const data = await action.handler(parsed.data, ctx);
      await writeActionLog({
        ...base, result: 'ok', errorCode: null, decision: 'approval_required',
        approvalId: consumed.approvalId ?? null,
        durationMs: Date.now() - startedAt,
      });
      return { ok: true, data };
    } catch (err) {
      const code: ActionErrorCode = err instanceof ActionError ? err.code : 'internal';
      if (code === 'internal') dbLogger.error('action handler threw', err, { action: action.name });
      await logErr(code, { decision: 'approval_required', approvalId: consumed.approvalId ?? null });
      return fail(code, err instanceof ActionError ? err.message : 'Erro interno.');
    }
  }
  // 4. Tenant selector guard — reject untrusted clinicId/clinic_id before Zod strips it
  if (rawInput !== null && typeof rawInput === 'object' && !Array.isArray(rawInput)) {
    const hasClinicId = Object.prototype.hasOwnProperty.call(rawInput as Record<string, unknown>, 'clinicId');
    const hasClinicIdSnake = Object.prototype.hasOwnProperty.call(rawInput as Record<string, unknown>, 'clinic_id');
    if (hasClinicId || hasClinicIdSnake) {
      await logDeny('invalid_input');
      return fail('invalid_input', 'Dados inválidos.');
    }
  }

  // 4. Input
  const parsed = action.input.safeParse(rawInput);
  if (!parsed.success) { await logDeny('invalid_input'); return fail('invalid_input', 'Dados inválidos.'); }

  // 5. Handler
  try {
    const data = await action.handler(parsed.data, ctx);
    await writeActionLog({
      ...base, result: 'ok', errorCode: null, decision: 'allow',
      durationMs: Date.now() - startedAt,
    });
    return { ok: true, data };
  } catch (err) {
    const code: ActionErrorCode = err instanceof ActionError ? err.code : 'internal';
    if (code === 'internal') dbLogger.error('action handler threw', err, { action: action.name });
    await logErr(code);
    return fail(code, err instanceof ActionError ? err.message : 'Erro interno.');
  }
}
