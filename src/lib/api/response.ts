/**
 * API Response Builders (ADR-BASE-10)
 *
 * Contrato uniforme para todas as respostas de API:
 *   Success: { data: T; meta?: { cursor?: string; total?: number } }
 *   Failure: { error: { code: string; message: string; requestId: string } }
 *
 * UUIDs para IDs, ISO 8601 UTC para datas, camelCase para campos.
 */

import { NextResponse } from 'next/server';

// ── Types ──────────────────────────────────────

export interface ApiMeta {
  cursor?: string;
  total?: number;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  requestId: string;
}

export interface ApiFailure {
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// ── Builders ───────────────────────────────────

/**
 * Success response with optional metadata (pagination cursor, total count).
 */
export function apiSuccess<T>(
  data: T,
  meta?: ApiMeta,
  status = 200,
): NextResponse<ApiSuccess<T>> {
  const body: ApiSuccess<T> = { data };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status });
}

/**
 * Created (201) convenience wrapper.
 */
export function apiCreated<T>(data: T, meta?: ApiMeta): NextResponse<ApiSuccess<T>> {
  return apiSuccess(data, meta, 201);
}

/**
 * Error response with code, message and unique request ID for tracing.
 */
export function apiFailure(
  code: string,
  message: string,
  requestId: string,
  status = 400,
): NextResponse<ApiFailure> {
  return NextResponse.json(
    { error: { code, message, requestId } },
    { status },
  );
}

/**
 * Standard HTTP error shortcuts.
 */
export const apiErrors = {
  badRequest: (message: string, requestId: string) =>
    apiFailure('BAD_REQUEST', message, requestId, 400),

  unauthorized: (message: string, requestId: string) =>
    apiFailure('UNAUTHORIZED', message, requestId, 401),

  forbidden: (message: string, requestId: string) =>
    apiFailure('FORBIDDEN', message, requestId, 403),

  notFound: (message: string, requestId: string) =>
    apiFailure('NOT_FOUND', message, requestId, 404),

  conflict: (message: string, requestId: string) =>
    apiFailure('CONFLICT', message, requestId, 409),

  tooManyRequests: (message: string, requestId: string) =>
    apiFailure('TOO_MANY_REQUESTS', message, requestId, 429),

  internal: (message: string, requestId: string) =>
    apiFailure('INTERNAL_ERROR', message, requestId, 500),
};

/**
 * Generate a unique request ID for tracing.
 * Falls back to crypto.randomUUID() in modern runtimes.
 */
export function generateRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for environments without Web Crypto
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

// ── ActionErrorCode → HTTP mapping (canonical) ────────────────
import type { ActionErrorCode } from '@/core/actions/types';

const actionErrorMap: Record<ActionErrorCode, { status: number; code: string }> = {
  unauthenticated: { status: 401, code: 'UNAUTHORIZED' },
  forbidden: { status: 403, code: 'FORBIDDEN' },
  not_found: { status: 404, code: 'NOT_FOUND' },
  conflict: { status: 409, code: 'CONFLICT' },
  invalid_input: { status: 422, code: 'INVALID_INPUT' },
  module_disabled: { status: 404, code: 'MODULE_DISABLED' },
  internal: { status: 500, code: 'INTERNAL_ERROR' },
};

export function mapActionError(code: ActionErrorCode): { status: number; code: string } {
  return actionErrorMap[code] ?? { status: 500, code: 'INTERNAL_ERROR' };
}

// ── Legacy-auth bridge (D2) ──────────────────────────────
// Rotas migradas que ainda usam `validateApiAuth` (sem Action correspondente)
// convertem o AuthResult para o envelope canônico de falha.
export function apiAuthFailure(
  error: { message: string; status: number } | undefined,
  requestId: string,
): NextResponse<ApiFailure> {
  const status = error?.status ?? 401;
  if (status === 401) return apiErrors.unauthorized(error?.message ?? 'Unauthorized', requestId);
  if (status === 403) return apiErrors.forbidden(error?.message ?? 'Forbidden', requestId);
  if (status === 404) return apiErrors.notFound(error?.message ?? 'Not found', requestId);
  return apiErrors.internal('Internal server error', requestId);
}
