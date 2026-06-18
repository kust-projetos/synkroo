import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError, ValidationError } from '@/lib/errors'

/**
 * GET /api/appointments/availability
 * Check available time slots for a given date and dentist.
 *
 * Legacy scheduler service removed.
 * TODO(W5.3): reconnect to new scheduler/agent.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date')

    if (!dateStr) {
      return handleApiError(new ValidationError('date is required'))
    }

    const date = new Date(dateStr + 'T00:00:00')
    const dayOfWeek = date.getDay()

    return NextResponse.json({
      available: false,
      date: dateStr,
      dayOfWeek,
      slots: [],
      reason: 'legacy_scheduler_removed',
      todo: 'TODO(W5.3): reconnect to new scheduler',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
