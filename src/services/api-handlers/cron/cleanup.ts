import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { lt } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { appointmentReminders, conversationStates, waitlist, conversationSessions } from '@/lib/db/schema'
import { apiSuccess, apiFailure, apiRateLimited, generateRequestId } from '@/lib/api/response'
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit'

/**
 * POST /api/cron/cleanup
 * Cron job endpoint to clean up old data.
 * Runs daily to remove old reminders, expired sessions, etc.
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    // Verify CRON_SECRET before rate limit — invalid credentials must not consume scheduler quota (T1 DoS fix).
    const cronSecret = request.headers.get('Authorization') || ''
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`
    if (
      !process.env.CRON_SECRET ||
      cronSecret.length !== expectedSecret.length ||
      !crypto.timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expectedSecret))
    ) {
      return apiFailure('UNAUTHORIZED', 'Unauthorized', requestId, 401)
    }

    const rateLimit = checkRateLimit('cron', rateLimitPresets.cron)
    if (!rateLimit.allowed) {
      return apiRateLimited(requestId, rateLimit.retryAfter)
    }

    const db = getDb()
    const results: Record<string, unknown> = {}
    const stepErrors: string[] = []
    const now = new Date()

    async function cleanStep(name: string, run: () => Promise<unknown>) {
      try {
        await run()
        results[name] = 'cleaned'
      } catch (stepError) {
        const message = stepError instanceof Error ? stepError.message : String(stepError)
        results[name] = 'failed'
        stepErrors.push(`${name}: ${message}`)
      }
    }

    // Clean up old reminders (> 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    await cleanStep('reminders', async () => {
      const deletedReminders = await db
        .delete(appointmentReminders)
        .where(lt(appointmentReminders.createdAt, thirtyDaysAgo))
      void deletedReminders
    })

    // Clean up old conversation states (> 7 days inactive)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    await cleanStep('conversationStates', async () => {
      await db
        .delete(conversationStates)
        .where(lt(conversationStates.updatedAt, sevenDaysAgo))
    })

    // Clean up expired conversation sessions (> 30 minutes)
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000)
    await cleanStep('conversationSessions', async () => {
      await db
        .delete(conversationSessions)
        .where(lt(conversationSessions.lastActivityAt, thirtyMinAgo))
    })

    // Clean up expired waitlist entries
    await cleanStep('waitlist', async () => {
      await db
        .delete(waitlist)
        .where(lt(waitlist.createdAt, thirtyDaysAgo))
    })

    // Contrato de lote: cada etapa reporta cleaned/failed; parcial nunca é
    // success:true puro. Falha total → success:false.
    const stepNames = Object.keys(results)
    const failedSteps = stepErrors.length
    const succeededSteps = stepNames.length - failedSteps
    const success = failedSteps === 0
    const status = failedSteps === 0 ? 'completed' : succeededSteps > 0 ? 'partial' : 'failed'

    return apiSuccess({
      success,
      status,
      timestamp: now.toISOString(),
      summary: { requested: stepNames.length, succeeded: succeededSteps, failed: failedSteps, skipped: 0, errors: stepErrors },
      results,
    })
  } catch (error) {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
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
