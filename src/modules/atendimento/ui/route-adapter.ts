/**
 * Atendimento — route adapter.
 *
 * Bridges Next.js route handlers → action system.
 * Reuses the same buildUserContext() / runAction / error mapping pattern
 * as src/modules/operacional/ui/route-adapter.ts.
 */
import { NextResponse } from 'next/server';
import { runAction } from '@/core/actions/run';
import { buildUserContext, buildDelegatedContext } from '@/core/actions/context';
import type { ActionDefinition } from '@/core/actions/types';

const errorCodeToStatus: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid_input: 422,
  internal: 500,
};

/**
 * Run an action with user context (authenticated routes).
 */
export async function runAtendimentoAction(
  action: ActionDefinition<any, any>,
  input: unknown,
  opts?: { okStatus?: number },
): Promise<NextResponse> {
  let ctx;
  try {
    ctx = await buildUserContext();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
  }
  const result = await runAction(action, input, ctx);
  if (result.ok) return NextResponse.json(result.data, { status: opts?.okStatus ?? 200 });
  const status = errorCodeToStatus[result.error.code] ?? 500;
  return NextResponse.json({ error: result.error.message }, { status });
}

/**
 * Run an action with system context (webhook/public routes).
 * @param clinicId - resolved clinic ID (from webhook payload or fallback)
 */
export async function runAtendimentoSystemAction(
  action: ActionDefinition<any, any>,
  input: unknown,
  clinicId: string,
  opts?: { okStatus?: number },
): Promise<NextResponse> {
  const ctx = {
    source: 'system' as const,
    clinicId,
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'webhook' },
  };
  const result = await runAction(action, input, ctx);
  if (result.ok) return NextResponse.json(result.data, { status: opts?.okStatus ?? 200 });
  const status = errorCodeToStatus[result.error.code] ?? 500;
  return NextResponse.json({ error: result.error.message }, { status });
}
