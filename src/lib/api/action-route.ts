import { NextResponse } from 'next/server'
import { apiFailure, apiSuccess, generateRequestId, mapActionError, type ApiMeta } from './response'
import { buildUserContext, buildSystemContext } from '@/core/actions/context'
import { runAction } from '@/core/actions/run'
import type { ActionDefinition } from '@/core/actions/types'

export type ActionRouteHandler<T> = (request: Request) => T | Promise<T>

export interface ActionRouteOptions {
  code?: string
  status?: number
  message?: string
  meta?: ApiMeta
}

/**
 * Adapts an Action handler to the canonical API response contract.
 * Existing routes can adopt this seam incrementally without changing their
 * business logic or serializers.
 */
export function createActionRoute<T>(
  handler: ActionRouteHandler<T>,
  options: ActionRouteOptions = {},
) {
  return async (request: Request) => {
    const requestId = request.headers.get('x-request-id') || generateRequestId()

    try {
      const result = await handler(request)
      let response
      if (result && typeof result === 'object' && 'data' in result && !Array.isArray(result)) {
        const withMeta = result as { data: unknown; meta?: ApiMeta }
        response = apiSuccess(withMeta.data, withMeta.meta ?? options.meta)
      } else {
        response = apiSuccess(result, options.meta)
      }
      response.headers.set('x-request-id', requestId)
      return response
    } catch (error) {
      // Nunca leaking error.message bruto para cliente em erro inesperado
      const isOperational = error instanceof Error && (error as any).code && typeof (error as any).code === 'string';
      const message = options.message ?? (isOperational ? (error as Error).message : 'Internal server error');
      const code = options.code ?? (isOperational ? (error as any).code : 'INTERNAL_ERROR');
      const status = options.status ?? (isOperational ? 400 : 500);
      const response = apiFailure(code, message, requestId, status)
      response.headers.set('x-request-id', requestId)
      return response
    }
  }
}

// ── Single shared Action handler (T4) ──────────────────────────
// One function to build context, runAction, map ActionErrorCode and write
// { data, meta? } or { error: { code, message, requestId } } with x-request-id.
// Wrappers only configure owner/context/serializer.

export interface CanonicalActionOptions {
  okStatus?: number
  meta?: ApiMeta
  isSystem?: boolean
  systemClinicId?: string
}

export async function handleCanonicalAction(
  request: Request | undefined,
  action: ActionDefinition<any, any>,
  input: unknown,
  opts: CanonicalActionOptions = {},
): Promise<NextResponse> {
  let requestId: string | null = null
  if (request?.headers?.get) {
    requestId = request.headers.get('x-request-id')
  }
  if (!requestId) {
    try {
      const { headers } = await import('next/headers')
      const h: any = await (headers as any)()
      requestId = h.get('x-request-id')
    } catch {}
  }
  if (!requestId) requestId = generateRequestId()

  let ctx: any
  try {
    if (opts.isSystem && opts.systemClinicId) {
      ctx = await buildSystemContext(opts.systemClinicId)
    } else {
      ctx = await buildUserContext()
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isUnauth = msg === 'unauthenticated'
    const status = isUnauth ? 401 : 500
    const code = isUnauth ? 'UNAUTHORIZED' : 'INTERNAL_ERROR'
    const message = isUnauth ? 'Unauthorized' : 'Internal server error'
    const res = apiFailure(code, message, requestId, status)
    res.headers.set('x-request-id', requestId)
    return res
  }

  const result = await runAction(action, input, ctx)

  if (result.ok) {
    const raw: any = result.data
    let data: unknown = raw
    let meta: ApiMeta | undefined = opts.meta

    if (raw && typeof raw === 'object' && !Array.isArray(raw) && ('data' in raw || 'meta' in raw || 'total' in raw)) {
      if ('data' in raw) {
        data = (raw as any).data
        meta = (raw as any).meta ?? ((raw as any).total !== undefined ? { total: (raw as any).total } : meta)
      } else if ('total' in raw && Array.isArray((raw as any).data)) {
        meta = { total: (raw as any).total }
        data = (raw as any).data
      }
    }

    const res = apiSuccess(data as any, meta, opts.okStatus ?? 200)
    res.headers.set('x-request-id', requestId)
    return res
  }

  const mapped = mapActionError(result.error.code as any)
  const message = mapped.code === 'INTERNAL_ERROR' ? 'Internal server error' : result.error.message
  const res = apiFailure(mapped.code, message, requestId, mapped.status)
  res.headers.set('x-request-id', requestId)
  return res
}
