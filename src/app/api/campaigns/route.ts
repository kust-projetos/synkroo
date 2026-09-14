import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  getCampaigns,
  createCampaign,
  createReactivationCampaign,
} from '@/services/followup/campaign.service'
import { getInactivityStats } from '@/services/followup/inactive-patient.service'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { withModuleRoute } from '@/core/modules/gates'
import { createCampaignSchema } from '@/lib/validations'

/**
 * GET /api/campaigns
 * List campaigns for authenticated user's clinic
 */
async function handleGET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('followup:view')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }
    const clinicId = authResult.profile!.clinic_id

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined

    const campaigns = await getCampaigns(clinicId, status)

    return apiSuccess({ campaigns })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

/**
 * POST /api/campaigns
 * Create a new campaign
 */
async function handlePOST(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('followup:manage_campaigns')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }
    const clinicId = authResult.profile!.clinic_id

    const rawBody = await request.json()
    const parsed = createCampaignSchema.safeParse(rawBody)
    if (!parsed.success) {
      return apiFailure('INVALID_INPUT', 'Validation failed', requestId, 400)
    }
    const body = parsed.data

    // Handle auto reactivation campaigns
    if (body.campaign_type === 'reactivation' && body.target_segment && body.auto_start) {
      const result = await createReactivationCampaign(
        clinicId,
        body.target_segment
      )

      if (!result.success) {
        return apiFailure('BAD_REQUEST', result.error ?? 'Failed to create reactivation campaign', requestId, 400)
      }

      const stats = await getInactivityStats(clinicId)

      return apiSuccess({
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
      return apiFailure('BAD_REQUEST', result.error ?? 'Failed to create campaign', requestId, 400)
    }

    return apiSuccess({
      success: true,
      campaign: result.campaign,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiFailure('INVALID_INPUT', 'Validation failed', requestId, 400)
    }
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

export const GET = withModuleRoute('followup')(handleGET)
export const POST = withModuleRoute('followup')(handlePOST)
