/**
 * Atendimento — route adapter (T4 canonical).
 */
import { NextResponse } from 'next/server';
import type { ActionDefinition, ActionContext, ActionResult } from '@/core/actions/types';
import { handleCanonicalAction } from '@/lib/api/action-route';
import { runAction } from '@/core/actions/run';

export async function runAtendimentoAction(
  action: ActionDefinition<any, any>,
  input: unknown,
  opts?: { okStatus?: number; request?: Request },
): Promise<NextResponse> {
  const request = (opts as any)?.request as Request | undefined;
  return handleCanonicalAction(request, action, input, { okStatus: opts?.okStatus }) as Promise<NextResponse>;
}

export async function runAtendimentoSystemAction(
  action: ActionDefinition<any, any>,
  input: unknown,
  clinicId: string,
  opts?: { okStatus?: number; request?: Request },
): Promise<NextResponse> {
  const request = (opts as any)?.request as Request | undefined;
  return handleCanonicalAction(request, action, input, { okStatus: opts?.okStatus, isSystem: true, systemClinicId: clinicId }) as Promise<NextResponse>;
}

export async function runAtendimentoSystemActionResult(
  action: ActionDefinition<any, any>,
  input: unknown,
  clinicId: string,
): Promise<ActionResult<unknown>> {
  const ctx: ActionContext = {
    source: 'system' as const,
    clinicId,
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'webhook' },
  };
  return runAction(action, input, ctx);
}
