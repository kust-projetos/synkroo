import { apiFailure, apiSuccess, generateRequestId, type ApiMeta } from './response'

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
