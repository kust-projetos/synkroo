import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getCampaigns,
  createCampaign,
  createReactivationCampaign,
} from '@/services/followup/campaign.service'
import { getInactivityStats } from '@/services/followup/inactive-patient.service'
import { validateApiAuth, hasRequiredRole } from '@/lib/supabase/server'
import { createCampaignSchema } from '@/lib/validations'
import { handleApiError, ValidationError } from '@/lib/errors'

/**
 * GET /api/campaigns
 * List campaigns for authenticated user's clinic
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin', 'dentist', 'receptionist'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined

    const campaigns = await getCampaigns(clinicId, status)

    return NextResponse.json({ campaigns })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/campaigns
 * Create a new campaign
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin'])) {
      return NextResponse.json(
        { error: 'Only owners and admins can create campaigns' },
        { status: 403 }
      )
    }

    const rawBody = await request.json()
    const body = createCampaignSchema.parse(rawBody)

    // Handle auto reactivation campaigns
    if (body.campaign_type === 'reactivation' && body.target_segment && body.auto_start) {
      const result = await createReactivationCampaign(
        clinicId,
        body.target_segment
      )

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        )
      }

      const stats = await getInactivityStats(clinicId)

      return NextResponse.json({
        success: true,
        campaign_id: result.campaignId,
        target_segment: body.target_segment,
        inactivity_stats: stats,
      })
    }

    // Create regular campaign
    const result = await createCampaign({
      clinicId,
      name: body.name,
      description: body.description,
      campaignType: body.campaign_type,
      targetSegment: body.target_segment,
      messageTemplate: body.message_template,
      channel: body.channel,
      scheduledAt: body.scheduled_at ? new Date(body.scheduled_at) : undefined,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      campaign: result.campaign,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}
