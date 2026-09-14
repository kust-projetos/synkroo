import { NextRequest } from 'next/server'
import { startCampaign } from '@/services/followup/campaign.service'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { withModuleRoute } from '@/core/modules/gates'
import * as campaignRepo from '@/repositories/campaigns'

/**
 * POST /api/campaigns/[id]/start
 * Start a campaign (begin sending messages)
 * Requires: owner or admin role
 */
async function handlePOST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId()
  try {
    const { id: campaignId } = await params

    const authResult = await validateApiAuth('followup:manage_campaigns')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const campaign = await campaignRepo.findCampaignById(campaignId)
    if (!campaign) {
      return apiFailure('NOT_FOUND', 'Campaign not found', requestId, 404)
    }

    if (campaign.clinicId !== authResult.profile!.clinic_id) {
      return apiFailure('FORBIDDEN', 'Access denied to this campaign', requestId, 403)
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return apiFailure(
        'BAD_REQUEST',
        'Campaign can only be started from draft or scheduled status',
        requestId,
        400,
      )
    }

    const result = await startCampaign(campaignId)

    if (!result.success) {
      return apiFailure('BAD_REQUEST', result.error ?? 'Failed to start campaign', requestId, 400)
    }

    return apiSuccess({ success: true, message: 'Campaign started successfully' })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

export const POST = withModuleRoute('followup')(handlePOST)
