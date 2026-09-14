import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { changePasswordSchema } from '@/lib/validations/auth'
import {
  checkRateLimit,
  createRateLimitHeaders,
  getClientIdentifier,
  rateLimitPresets,
} from '@/lib/rate-limit'
import { changeUserPassword } from '@/repositories/auth'

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const rateLimit = checkRateLimit(
    getClientIdentifier(request),
    rateLimitPresets.auth,
  )
  if (!rateLimit.allowed) {
    const headers = createRateLimitHeaders(
      rateLimit.remaining,
      rateLimit.resetTime,
      rateLimitPresets.auth.maxRequests,
    )
    if (rateLimit.retryAfter !== undefined) {
      headers['Retry-After'] = String(rateLimit.retryAfter)
    }
    const res = apiFailure('TOO_MANY_REQUESTS', 'Too many requests', requestId, 429)
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v)
    return res
  }

  const authResult = await validateApiAuth()
  if (!authResult.success) {
    return apiAuthFailure(authResult.error, requestId)
  }

  try {
    const parsed = changePasswordSchema.safeParse(await request.json())
    if (!parsed.success) {
      return apiFailure('INVALID_INPUT', 'Invalid password input', requestId, 400)
    }
    const input = parsed.data
    const result = await changeUserPassword(
      authResult.user!.id,
      input.currentPassword,
      input.nextPassword,
    )

    if (!result.ok) {
      return apiFailure('FORBIDDEN', 'Current password is incorrect', requestId, 403)
    }

    return apiSuccess({ success: true })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return apiFailure('INVALID_INPUT', 'Invalid password input', requestId, 400)
    }
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
