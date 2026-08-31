import { NextRequest, NextResponse } from 'next/server'
import { startCampaign } from '@/services/followup/campaign.service'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import * as campaignRepo from '@/repositories/campaigns'

/**
 * POST /api/campaigns/[id]/start
 * Start a campaign (begin sending messages)
 * Requires: owner or admin role
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params

    const authResult = await validateApiAuth('followup:manage_campaigns')
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const campaign = await campaignRepo.findCampaignById(campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.clinicId !== authResult.profile!.clinic_id) {
      return NextResponse.json({ error: 'Access denied to this campaign' }, { status: 403 })
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Campaign can only be started from draft or scheduled status' },
        { status: 400 }
      )
    }

    const result = await startCampaign(campaignId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Campaign started successfully' })
  } catch (error) {
    return handleApiError(error)
  }
}
