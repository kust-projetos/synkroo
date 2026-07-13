import { NextResponse } from 'next/server';
import { validateApiAuth } from '@/lib/auth/session';
import { runAction } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
import type { ActionDefinition } from '@/core/actions/types';

const statusByCode: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid_input: 422,
  module_disabled: 404,
  internal: 500,
};

export async function runCrmAction<O>(
  action: ActionDefinition<any, O>,
  input: Record<string, unknown>,
  opts?: { okStatus?: number },
): Promise<NextResponse> {
  try {
    const ctx = await buildUserContext();
    const merged = { ...input, clinicId: ctx.clinicId };
    const result = await runAction(action, merged, ctx);
    if (result.ok) {
      return NextResponse.json(result.data, { status: opts?.okStatus ?? 200 });
    }
    return NextResponse.json(
      { error: result.error.message },
      { status: statusByCode[result.error.code] ?? 500 },
    );
  } catch (err) {
    const unauth = err instanceof Error && err.message === 'unauthenticated';
    return NextResponse.json(
      { error: unauth ? 'Unauthorized' : 'Authentication error' },
      { status: unauth ? 401 : 500 },
    );
  }
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
