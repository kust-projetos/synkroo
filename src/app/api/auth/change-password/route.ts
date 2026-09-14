import { NextRequest } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import {
  checkRateLimit,
  createRateLimitHeaders,
  getClientIdentifier,
  rateLimitPresets,
} from '@/lib/rate-limit'
import { changeUserPassword } from '@/repositories/auth'

// NOTA D2 lote 5: sem módulo correspondente (auth é transversal) — mantém
// validateApiAuth + envelope canônico mínimo, sem gate withModuleRoute.
// O schema inline será consolidado em src/lib/validations/auth.ts na D3.
const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  nextPassword: z.string().min(6, 'New password must be at least 6 characters').max(128),
})

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
