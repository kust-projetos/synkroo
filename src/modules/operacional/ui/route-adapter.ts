/**
 * Operacional — route adapter (T4 canonical).
 */

import { NextResponse } from 'next/server';
import type { ActionDefinition } from '@/core/actions/types';
import { handleCanonicalAction } from '@/lib/api/action-route';

export async function runActionRoute(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: ActionDefinition<any, any>,
  input: unknown,
  opts?: { okStatus?: number; request?: Request },
): Promise<NextResponse> {
  const request = (opts as any)?.request as Request | undefined;
  return handleCanonicalAction(request, action, input, { okStatus: opts?.okStatus }) as Promise<NextResponse>;
}

export function auth401Response(): NextResponse {
  return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: 'req_anon' } }, { status: 401 });
}
