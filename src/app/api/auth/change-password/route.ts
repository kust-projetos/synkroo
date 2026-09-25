import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, apiRateLimited, generateRequestId } from '@/lib/api/response'
import { changePasswordSchema } from '@/lib/validations/auth'
import {
  checkRateLimit,
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
    return apiRateLimited(requestId, rateLimit.retryAfter, 'Too many requests')
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
