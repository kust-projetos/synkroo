import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit'

/**
 * POST /api/cron/smart-triggers
 * Cron endpoint to process all smart triggers.
 *
 * TODO(W5.3): reconnect to new agent.
 * Legacy agent removed — returns no-op.
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

    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'legacy_agent_removed',
      todo: 'TODO(W5.3): reconnect to new agent',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal error', reason: String(error) },
      { status: 500 }
    )
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
