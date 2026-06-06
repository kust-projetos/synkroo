import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { processAllReminders } from '@/services/reminders/reminder.service'
import { handleApiError } from '@/lib/errors'

/**
 * POST /api/cron/reminders
 * Cron job endpoint to process appointment reminders
 *
 * This endpoint should be called every 5 minutes by a cron job
 * or scheduled task (Supabase pg_cron, Vercel Cron, etc.)
 *
 * Security: Requires CRON_SECRET header for authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const cronSecret = request.headers.get('Authorization') || ''
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`

    if (!process.env.CRON_SECRET ||
        cronSecret.length !== expectedSecret.length ||
        !crypto.timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expectedSecret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Process all reminders
    await processAllReminders()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/cron/reminders
 * Health check for cron endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Reminder cron endpoint is active',
    timestamp: new Date().toISOString(),
  })
}