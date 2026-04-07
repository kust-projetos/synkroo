import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'
import { acknowledgeNotification } from '@/services/leads/lead-notification.service'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PUT /api/leads/notifications/[id]/acknowledge
 * Mark a notification as acknowledged
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const success = await acknowledgeNotification(id)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to acknowledge notification' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
