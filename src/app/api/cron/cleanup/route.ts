import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

/**
 * POST /api/cron/cleanup
 * Cron job endpoint to clean up old data
 *
 * Runs daily at 3 AM to:
 * - Remove old reminders (> 30 days)
 * - Archive old conversations (> 90 days)
 * - Clean up expired sessions
 *
 * Security: Requires CRON_SECRET header for authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const cronSecret = request.headers.get('Authorization')
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`

    if (!process.env.CRON_SECRET || cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient() as any
    const results: Record<string, unknown> = {}

    // Clean up old reminders (> 30 days)
    const { data: deletedReminders, error: remindersError } = await supabase
      .rpc('cleanup_old_reminders')
      .catch(() => ({ data: null, error: 'Function not found' }))

    if (!remindersError) {
      results.reminders = 'cleaned'
    }

    // Clean up old conversation states (> 7 days inactive)
    const { error: statesError } = await supabase
      .from('conversation_states')
      .delete()
      .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    if (!statesError) {
      results.conversationStates = 'cleaned'
    }

    // Clean up expired waitlist entries (> 30 days)
    const { error: waitlistError } = await supabase
      .from('waitlist')
      .delete()
      .eq('status', 'expired')
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    if (!waitlistError) {
      results.waitlist = 'cleaned'
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error) {
    console.error('Error running cleanup:', error)
    return NextResponse.json(
      { error: 'Failed to run cleanup' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/cleanup
 * Health check for cron endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Cleanup cron endpoint is active',
    tasks: ['reminders', 'conversation_states', 'waitlist'],
    timestamp: new Date().toISOString(),
  })
}