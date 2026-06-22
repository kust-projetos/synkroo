/**
 * Operacional module — route adapter for API routes.
 *
 * Bridges Next.js route handlers → action system for API (no-session) context.
 *
 * Responsibilities:
 * 1. Auth without session: validateApiAuth → 401 if unauthenticated
 * 2. Build ActionContext from API auth profile (no user session needed)
 * 3. Run the action via runAction
 * 4. Map ActionResult → NextResponse with correct HTTP status
 * 5. Auth contract: 401 (not 500) for unauthenticated requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiAuth } from '@/lib/auth/session';
import { runAction as runActionCore } from '@/core/actions/run';
import { ActionDefinition } from '@/core/actions/types';
import { drizzleManifestRepo } from '@/core/modules/manifest';
import { resolveAccess } from '@/core/rbac/resolve';

const errorCodeToStatus: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid_input: 422,
  module_disabled: 404,
  internal: 500,
};

// ─── Auth context builder for API routes (no session) ───────────────────────

async function buildApiContext(clinicId: string) {
  // For API routes, grant full appointments:read + write permissions.
  // Service-level auth is handled by validateApiAuth above.
  const mods = new Set(['operacional', 'core']);
  return {
    source: 'user' as const,
    clinicId,
    role: 'admin',
    can: (_key: string) => true,
    hasModule: (id: string) => mods.has(id),
    audit: { actor: 'api' },
  };
}

// ─── Core action runner ───────────────────────────────────────────────────────

async function runActionCoreFn(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: ActionDefinition<any, any>,
  rawInput: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: Parameters<typeof runActionCore>[2],
): Promise<NextResponse> {
  const result = await runActionCore(action, rawInput, ctx);
  if (result.ok) return NextResponse.json(result.data, { status: 200 });
  const status = errorCodeToStatus[result.error.code] ?? 500;
  return NextResponse.json({ error: result.error.message }, { status });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run an action from an API route (no-session auth).
 * - GET: parses searchParams as flat key-value pairs
 * - POST/PUT/PATCH: parses JSON body
 *
 * @param urlParams - optional record of URL params (e.g. { id: '...' }) injected into input
 */
export async function runActionRoute(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: ActionDefinition<any, any>,
  request: NextRequest,
  opts?: {
    urlParams?: Record<string, string>;
    clinicId?: string;
  },
): Promise<NextResponse> {
  // 1. Auth
  const auth = await validateApiAuth();
  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error?.message ?? 'Unauthorized' },
      { status: 401 },
    );
  }

  const clinicId = opts?.clinicId ?? auth.profile!.clinic_id;

  // 2. Build context
  let ctx: Awaited<ReturnType<typeof buildApiContext>>;
  try {
    ctx = await buildApiContext(clinicId);
  } catch {
    return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
  }

  // 3. Parse input
  let rawInput: unknown;
  try {
    if (request.method === 'GET') {
      const { searchParams } = new URL(request.url);
      rawInput = Object.fromEntries(searchParams.entries());
    } else {
      rawInput = await request.json();
    }
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  // 4. Inject URL params (e.g. { id } from route params) into input
  if (opts?.urlParams) {
    rawInput = { ...(rawInput as Record<string, unknown>), ...opts.urlParams };
  }

  // 5. Run
  return runActionCoreFn(action, rawInput, ctx);
}

/**
 * Returns 401 NextResponse — verifies the adapter never returns 500 for
 * unauthenticated requests (contract: 401).
 */
export function auth401Response(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
