/**
 * Financeiro — route adapter for API routes.
 * Thin wrapper over canonical Action handler (T4).
 */

import { NextResponse } from 'next/server';
import type { ActionDefinition } from '@/core/actions/types';
import { handleCanonicalAction } from '@/lib/api/action-route';

/**
 * Run a financeiro action with user context (authenticated routes).
 * Delegates to single shared canonical handler.
 */
export async function runFinanceiroAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: ActionDefinition<any, any>,
  input: unknown,
  opts?: { okStatus?: number; request?: Request },
): Promise<NextResponse> {
  const request = (opts as any)?.request as Request | undefined;
  return handleCanonicalAction(request, action, input, { okStatus: opts?.okStatus }) as Promise<NextResponse>;
}

/**
 * Run a financeiro action with system context (cron/system routes).
 */
export async function runFinanceiroSystemAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: ActionDefinition<any, any>,
  input: unknown,
  clinicId: string,
  opts?: { okStatus?: number; request?: Request },
): Promise<NextResponse> {
  const request = (opts as any)?.request as Request | undefined;
  return handleCanonicalAction(request, action, input, { okStatus: opts?.okStatus, isSystem: true, systemClinicId: clinicId }) as Promise<NextResponse>;
}
