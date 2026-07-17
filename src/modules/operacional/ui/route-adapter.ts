/**
 * Operacional module — route adapter for API routes.
 *
 * Bridges Next.js route handlers → action system.
 * Uses buildUserContext() from @/core/actions/context so auth failures
 * throw Error('unauthenticated') → adapter returns 401.
 *
 * Contract: unauthenticated → 401 (not 500).
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAction as runActionCore } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
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

// ─── Core runner ─────────────────────────────────────────────────────────────

async function runActionCoreFn(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: ActionDefinition<any, any>,
  rawInput: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: Parameters<typeof runActionCore>[2],
  okStatus = 200,
): Promise<NextResponse> {
  const result = await runActionCore(action, rawInput, ctx);
  if (result.ok) return NextResponse.json(result.data, { status: okStatus });
  const status = errorCodeToStatus[result.error.code] ?? 500;
  return NextResponse.json({ error: result.error.message }, { status });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run an action from an API route.
 *
 * @param action   - registered action definition
 * @param input    - parsed action input (body or query-params object)
 * @param opts.okStatus - HTTP status on success (default 200; use 201 for POST creates)
 */
export async function runActionRoute(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: ActionDefinition<any, any>,
  input: unknown,
  opts?: { okStatus?: number },
): Promise<NextResponse> {
  // 1. Build context — buildUserContext() throws Error('unauthenticated') if no session
  let ctx: Awaited<ReturnType<typeof buildUserContext>>;
  try {
    ctx = await buildUserContext();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
  }

  // 2. Run
  return runActionCoreFn(action, input, ctx, opts?.okStatus);
}

/**
 * Returns a 401 NextResponse — for direct use in routes that need early exit.
 */
export function auth401Response(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
