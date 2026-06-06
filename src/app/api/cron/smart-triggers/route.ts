import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { dbLogger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit'

/**
 * POST /api/cron/smart-triggers
 * Cron endpoint to process all smart triggers
 *
 * Headers:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit cron endpoints
    const rateLimit = checkRateLimit('cron', rateLimitPresets.cron)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    // Verify cron secret
    const authHeader = request.headers.get('Authorization') || ''
    const cronSecret = process.env.CRON_SECRET
    const expectedSecret = cronSecret ? `Bearer ${cronSecret}` : ''

    if (cronSecret && (
      authHeader.length !== expectedSecret.length ||
      !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedSecret))
    )) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Dynamic import to avoid circular deps at module load
    const { smartTriggersService } = await import('@/services/agent/smart-triggers.service')
    const { pendingActionsService } = await import('@/services/agent/pending-actions.service')

    dbLogger.info('Cron: Starting smart triggers processing')

    // Process all triggers
    const triggerResults = await smartTriggersService.processAll()

    // Also expire old pending actions
    const expiredCount = await pendingActionsService.expireOldActions()

    dbLogger.info('Cron: Smart triggers processed', { ...triggerResults, expiredActions: expiredCount })

    return NextResponse.json({
      success: true,
      triggers: triggerResults,
      expiredActions: expiredCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/cron/smart-triggers
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'synkroo-smart-triggers-cron',
    timestamp: new Date().toISOString(),
  })
}
