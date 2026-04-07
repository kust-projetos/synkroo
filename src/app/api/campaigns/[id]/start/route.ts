import { NextRequest, NextResponse } from 'next/server'
import { startCampaign } from '@/services/followup/campaign.service'
import { validateApiAuth, hasRequiredRole, createClient } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'

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

    // Validate authentication
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    // Only owner and admin can start campaigns
    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin'])) {
      return NextResponse.json(
        { error: 'Only owners and admins can start campaigns' },
        { status: 403 }
      )
    }

    // Verify campaign belongs to user's clinic
    const supabase = await createClient()
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('clinic_id, status')
      .eq('id', campaignId)
      .single() as { data: { clinic_id: string; status: string } | null; error: any }

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    if (campaign.clinic_id !== authResult.profile!.clinic_id) {
      return NextResponse.json(
        { error: 'Access denied to this campaign' },
        { status: 403 }
      )
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Campaign can only be started from draft or scheduled status' },
        { status: 400 }
      )
    }

    const result = await startCampaign(campaignId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign started successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
}