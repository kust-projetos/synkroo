import { NextRequest, NextResponse } from 'next/server'
import { addCampaignRecipients } from '@/services/followup/campaign.service'
import { getPatientsForReactivation } from '@/services/followup/inactive-patient.service'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError, ValidationError } from '@/lib/errors'
import * as campaignRepo from '@/repositories/campaigns'

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

    if (body.auto_detect && body.target_segment) {
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

    if (!body.patient_ids || !Array.isArray(body.patient_ids)) {
      return handleApiError(new ValidationError('patient_ids array is required'))
    }

    const result = await addCampaignRecipients(campaignId, body.patient_ids)

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
