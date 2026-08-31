import { NextRequest, NextResponse } from 'next/server';
import { validateApiAuth } from '@/lib/auth/session';
import type { ActionDefinition } from '@/core/actions/types';
import { handleCanonicalAction } from '@/lib/api/action-route';

export async function runCrmAction<O>(
  action: ActionDefinition<any, O>,
  input: Record<string, unknown>,
  opts?: { okStatus?: number; request?: Request },
): Promise<NextResponse> {
  const request = (opts as any)?.request as Request | undefined;
  return handleCanonicalAction(request, action, input, { okStatus: opts?.okStatus }) as Promise<NextResponse>;
}

/**
 * CRM read-only response for write methods (POST/PUT/PATCH/DELETE).
 * Used while CRM is in MVP read-only mode.
 */
export async function crmReadOnlyResponse(
  _request: NextRequest,
  ..._rest: unknown[]
): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'crm_mvp_read_only' },
    { status: 405 },
  );
}

export async function validateRequest() {
  const auth = await validateApiAuth();
  if (!auth.success) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: auth.error?.message },
        { status: auth.error?.status ?? 401 },
      ),
    };
  }
  return { ok: true as const, profile: auth.profile! };
}
