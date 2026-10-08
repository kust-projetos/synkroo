import type { ActionContext, ActionDefinition, ActionResult, ActionErrorCode } from './types';
import { ActionError } from './types';
import { allowlistInput, writeActionLog } from './audit-writer';
import { dbLogger } from '@/lib/logger';

function fail(code: ActionErrorCode, message: string) {
  return { ok: false as const, error: { code, message } };
}

export async function runAction<O>(
  action: ActionDefinition<any, O>,
  rawInput: unknown,
  ctx: ActionContext,
): Promise<ActionResult<O>> {
  // 1. Auth por principal — deny: sem input (atacante-controlável) no log
  if (!ctx || !ctx.clinicId || (ctx.source !== 'system' && !ctx.user)) {
    await writeActionLog({
      clinicId: ctx?.clinicId ?? null, principalType: ctx?.source ?? null,
      actor: ctx?.audit?.actor ?? 'unknown', onBehalfOf: ctx?.audit?.onBehalfOf,
      actionName: action.name, module: action.module,
      inputRedacted: {},
      result: 'error', errorCode: 'unauthenticated',
    });
    return fail('unauthenticated', 'Não autenticado.');
  }

  // inputRedacted só em paths permitidos (allow). Deny (gates 2–4) loga
  // apenas {action, source, code} — nunca o input bruto, que pode embutir
  // PII/segredo em campos atacante-controláveis (ex.: idempotencyKey).
  const denyBase = {
    clinicId: ctx.clinicId, principalType: ctx.source, actor: ctx.audit.actor,
    onBehalfOf: ctx.audit.onBehalfOf, actionName: action.name, module: action.module,
    inputRedacted: {} as Record<string, unknown>,
  };
  const base = {
    ...denyBase,
    inputRedacted: allowlistInput(rawInput, action.auditFields ?? []),
  };
  const logDeny = (code: ActionErrorCode) =>
    writeActionLog({ ...denyBase, result: 'error', errorCode: code });
  const logErr = (code: ActionErrorCode) =>
    writeActionLog({ ...base, result: 'error', errorCode: code });

  // 2. Gate manifesto
  if (!ctx.hasModule(action.module)) { await logDeny('module_disabled'); return fail('module_disabled', 'Módulo não disponível.'); }
  // 3. Gate RBAC
  if (!ctx.can(action.requires)) { await logDeny('forbidden'); return fail('forbidden', 'Sem permissão.'); }
  // 3b. Gate de classe de risco DENY — só ADICIONA negação, nunca afrouxa:
  // ações 'deny_non_human' exigem principal humano (source === 'user').
  // Delegated/system caem em 'forbidden' (deny hard; approval = via humana).
  if (action.riskClass === 'deny_non_human' && ctx.source !== 'user') {
    await logDeny('forbidden');
    return fail('forbidden', 'Sem permissão.');
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
    await writeActionLog({ ...base, result: 'ok', errorCode: null });
    return { ok: true, data };
  } catch (err) {
    const code: ActionErrorCode = err instanceof ActionError ? err.code : 'internal';
    if (code === 'internal') dbLogger.error('action handler threw', err, { action: action.name });
    await logErr(code);
    return fail(code, err instanceof ActionError ? err.message : 'Erro interno.');
  }
}
