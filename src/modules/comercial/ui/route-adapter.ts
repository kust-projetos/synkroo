/**
 * Comercial — route adapter (T4 canonical).
 */

import { NextResponse } from 'next/server';
import type { ActionDefinition } from '@/core/actions/types';
import { handleCanonicalAction } from '@/lib/api/action-route';

export async function runComercialAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: ActionDefinition<any, any>,
  input: unknown,
  opts?: { okStatus?: number; request?: Request },
): Promise<NextResponse> {
  const request = (opts as any)?.request as Request | undefined;
  return handleCanonicalAction(request, action, input, { okStatus: opts?.okStatus }) as Promise<NextResponse>;
}

export async function runComercialSystemAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: ActionDefinition<any, any>,
  input: unknown,
  clinicId: string,
  opts?: { okStatus?: number; request?: Request },
): Promise<NextResponse> {
  const request = (opts as any)?.request as Request | undefined;
  return handleCanonicalAction(request, action, input, { okStatus: opts?.okStatus, isSystem: true, systemClinicId: clinicId }) as Promise<NextResponse>;
}
