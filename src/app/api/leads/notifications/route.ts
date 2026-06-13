import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import {
  getUnacknowledgedNotifications,
  checkAndNotifyHotLeads,
} from '@/services/leads/lead-notification.service'

/**
 * GET /api/leads/notifications
 * List unacknowledged hot lead alerts
 */
export async function GET() {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const notifications = await getUnacknowledgedNotifications(clinicId)

    return NextResponse.json({
      notifications,
      count: notifications.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/leads/notifications
 * Manually trigger hot lead check for the clinic
 */
export async function POST() {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id

    await checkAndNotifyHotLeads(clinicId)

    // Fetch updated list after check
    const notifications = await getUnacknowledgedNotifications(clinicId)

    return NextResponse.json({
      success: true,
      message: 'Hot lead check completed',
      notifications,
      count: notifications.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
