/**
 * Comercial module — route adapter for API routes.
 *
 * Bridges Next.js route handlers → action system.
 * Pattern mirrors @/modules/atendimento/ui/route-adapter.ts.
 */

import { NextResponse } from 'next/server';
import { runAction } from '@/core/actions/run';
import { buildUserContext, buildSystemContext } from '@/core/actions/context';
import type { ActionDefinition } from '@/core/actions/types';

const errorCodeToStatus: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid_input: 422,
  module_disabled: 404,
  internal: 500,
};

/**
 * Run a comercial action with user context (authenticated routes).
 */
export async function runComercialAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: ActionDefinition<any, any>,
  input: unknown,
  opts?: { okStatus?: number },
): Promise<NextResponse> {
  let ctx;
  try {
    ctx = await buildUserContext();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
  }

  // Inject clinicId from auth context into action input
  const mergedInput = { ...(input as Record<string, unknown> || {}), clinicId: ctx.clinicId };

  const result = await runAction(action, mergedInput, ctx);
  if (result.ok) {
    return NextResponse.json(result.data, { status: opts?.okStatus ?? 200 });
  }
  const status = errorCodeToStatus[result.error.code] ?? 500;
  return NextResponse.json({ error: result.error.message }, { status });
}

/**
 * Run a comercial action with system context (cron/system routes).
 */
export async function runComercialSystemAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: ActionDefinition<any, any>,
  input: unknown,
  clinicId: string,
  opts?: { okStatus?: number },
): Promise<NextResponse> {
  const ctx = await buildSystemContext(clinicId);

  const result = await runAction(action, input, ctx);
  if (result.ok) {
    return NextResponse.json(result.data, { status: opts?.okStatus ?? 200 });
  }
  const status = errorCodeToStatus[result.error.code] ?? 500;
  return NextResponse.json({ error: result.error.message }, { status });
}
