import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { lt } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { appointmentReminders, conversationStates, waitlist, conversationSessions } from '@/lib/db/schema'
import { handleApiError } from '@/lib/errors'
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit'

/**
 * POST /api/cron/cleanup
 * Cron job endpoint to clean up old data.
 * Runs daily to remove old reminders, expired sessions, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit('cron', rateLimitPresets.cron)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }

    const cronSecret = request.headers.get('Authorization') || ''
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`
    if (
      !process.env.CRON_SECRET ||
      cronSecret.length !== expectedSecret.length ||
      !crypto.timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expectedSecret))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getDb()
    const results: Record<string, unknown> = {}
    const now = new Date()

    // Clean up old reminders (> 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const deletedReminders = await db
      .delete(appointmentReminders)
      .where(lt(appointmentReminders.createdAt, thirtyDaysAgo))
    results.reminders = 'cleaned'

    // Clean up old conversation states (> 7 days inactive)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    await db
      .delete(conversationStates)
      .where(lt(conversationStates.updatedAt, sevenDaysAgo))
    results.conversationStates = 'cleaned'

    // Clean up expired conversation sessions (> 30 minutes)
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000)
    await db
      .delete(conversationSessions)
      .where(lt(conversationSessions.lastActivityAt, thirtyMinAgo))
    results.conversationSessions = 'cleaned'

    // Clean up expired waitlist entries
    await db
      .delete(waitlist)
      .where(lt(waitlist.createdAt, thirtyDaysAgo))

    results.waitlist = 'cleaned'

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Cleanup cron endpoint is active',
    tasks: ['reminders', 'conversation_states', 'waitlist'],
    timestamp: new Date().toISOString(),
  })
}
