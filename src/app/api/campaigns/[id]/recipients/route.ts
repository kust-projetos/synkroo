import { NextRequest, NextResponse } from 'next/server'
import { addCampaignRecipients, startCampaign } from '@/services/followup/campaign.service'
import { getPatientsForReactivation } from '@/services/followup/inactive-patient.service'
import { validateApiAuth, hasRequiredRole, createClient } from '@/lib/supabase/server'

/**
 * POST /api/campaigns/[id]/recipients
 * Add recipients to a campaign
 * Requires: owner or admin role
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const body = await request.json()

    // Validate authentication
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    // Only owner and admin can add recipients
    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin'])) {
      return NextResponse.json(
        { error: 'Only owners and admins can add recipients' },
        { status: 403 }
      )
    }

    // Verify campaign belongs to user's clinic
    const supabase = await createClient()
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('clinic_id')
      .eq('id', campaignId)
      .single()

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

    if (body.auto_detect && body.target_segment) {
      // Auto-detect patients for reactivation
      const patients = await getPatientsForReactivation(
        authResult.profile!.clinic_id,
        body.target_segment
      )

      if (patients.length === 0) {
        return NextResponse.json({
          success: true,
          added: 0,
          message: 'No patients found for this segment',
        })
      }

      const result = await addCampaignRecipients(
        campaignId,
        patients.map((p: any) => p.patientId)
      )

      return NextResponse.json(result)
    }

    // Manual patient list
    if (!body.patient_ids || !Array.isArray(body.patient_ids)) {
      return NextResponse.json(
        { error: 'patient_ids array is required' },
        { status: 400 }
      )
    }

    const result = await addCampaignRecipients(campaignId, body.patient_ids)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error adding recipients:', error)
    return NextResponse.json(
      { error: 'Failed to add recipients' },
      { status: 500 }
    )
  }
}