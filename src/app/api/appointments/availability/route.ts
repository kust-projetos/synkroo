import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { getAvailableSlots } from '@/services/scheduler/scheduler.service'

/**
 * GET /api/appointments/availability
 * Check available time slots for a given date and dentist
 *
 * Query params:
 * - date: string (YYYY-MM-DD, required)
 * - dentist_id: string (optional)
 * - duration_minutes: number (default: 30)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date')
    const dentistId = searchParams.get('dentist_id') || undefined
    const durationMinutes = parseInt(searchParams.get('duration_minutes') || '30')

    if (!dateStr) {
      return NextResponse.json(
        { error: 'date is required' },
        { status: 400 }
      )
    }

    const slots = await getAvailableSlots(clinicId, dateStr, durationMinutes, dentistId)

    const date = new Date(dateStr + 'T00:00:00')
    const dayOfWeek = date.getDay()

    return NextResponse.json({
      available: slots.some(s => s.available),
      date: dateStr,
      dayOfWeek,
      slots,
    })
  } catch (error) {
    console.error('Error checking availability:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}