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
  // 1. Auth por principal
  if (!ctx || !ctx.clinicId || (ctx.source !== 'system' && !ctx.user)) {
    await writeActionLog({
      clinicId: ctx?.clinicId ?? null, principalType: ctx?.source ?? null,
      actor: ctx?.audit?.actor ?? 'unknown', onBehalfOf: ctx?.audit?.onBehalfOf,
      actionName: action.name, module: action.module,
      inputRedacted: allowlistInput(rawInput, action.auditFields ?? []),
      result: 'error', errorCode: 'unauthenticated',
    });
    return fail('unauthenticated', 'Não autenticado.');
  }

  const base = {
    clinicId: ctx.clinicId, principalType: ctx.source, actor: ctx.audit.actor,
    onBehalfOf: ctx.audit.onBehalfOf, actionName: action.name, module: action.module,
    inputRedacted: allowlistInput(rawInput, action.auditFields ?? []),
  };
  const logErr = (code: ActionErrorCode) =>
    writeActionLog({ ...base, result: 'error', errorCode: code });

  // 2. Gate manifesto
  if (!ctx.hasModule(action.module)) { await logErr('module_disabled'); return fail('module_disabled', 'Módulo não disponível.'); }
  // 3. Gate RBAC
  if (!ctx.can(action.requires)) { await logErr('forbidden'); return fail('forbidden', 'Sem permissão.'); }
  // 4. Input
  const parsed = action.input.safeParse(rawInput);
  if (!parsed.success) { await logErr('invalid_input'); return fail('invalid_input', 'Dados inválidos.'); }

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
