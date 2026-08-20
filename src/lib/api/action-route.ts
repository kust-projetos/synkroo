import { apiFailure, apiSuccess, generateRequestId } from './response'

export type ActionRouteHandler<T> = (request: Request) => T | Promise<T>

export interface ActionRouteOptions {
  code?: string
  status?: number
  message?: string
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
      const response = apiSuccess(await handler(request))
      response.headers.set('x-request-id', requestId)
      return response
    } catch (error) {
      const message = options.message ?? (error instanceof Error ? error.message : 'Internal server error')
      const response = apiFailure(
        options.code ?? 'INTERNAL_ERROR',
        message,
        requestId,
        options.status ?? 500,
      )
      response.headers.set('x-request-id', requestId)
      return response
    }
  }
}
