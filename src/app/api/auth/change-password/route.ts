import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import {
  checkRateLimit,
  createRateLimitHeaders,
  getClientIdentifier,
  rateLimitPresets,
} from '@/lib/rate-limit'
import { changeUserPassword } from '@/repositories/auth'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  nextPassword: z.string().min(6, 'New password must be at least 6 characters').max(128),
})

export async function POST(request: NextRequest) {
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
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers },
    )
  }

  const authResult = await validateApiAuth()
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error!.message },
      { status: authResult.error!.status },
    )
  }

  try {
    const input = changePasswordSchema.parse(await request.json())
    const result = await changeUserPassword(
      authResult.user!.id,
      input.currentPassword,
      input.nextPassword,
    )

    if (!result.ok) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 403 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid password input' }, { status: 400 })
    }
    return handleApiError(error)
  }
}
