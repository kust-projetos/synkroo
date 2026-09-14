import { NextRequest } from 'next/server'
import { addCampaignRecipients } from '@/services/followup/campaign.service'
import { getPatientsForReactivation } from '@/services/followup/inactive-patient.service'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { withModuleRoute } from '@/core/modules/gates'
import * as campaignRepo from '@/repositories/campaigns'

/**
 * POST /api/campaigns/[id]/recipients
 * Add recipients to a campaign
 * Requires: owner or admin role
 */
async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId()
  try {
    const { id: campaignId } = await params
    const body = await request.json()

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

    if (body.auto_detect && body.target_segment) {
      const patients = await getPatientsForReactivation(
        authResult.profile!.clinic_id,
        body.target_segment
      )

      if (patients.length === 0) {
        return apiSuccess({
          success: true,
          added: 0,
          message: 'No patients found for this segment',
        })
      }

      const result = await addCampaignRecipients(
        campaignId,
        patients.map((p: any) => p.patientId)
      )

      return apiSuccess(result)
    }

    if (!body.patient_ids || !Array.isArray(body.patient_ids)) {
      return apiFailure('INVALID_INPUT', 'patient_ids array is required', requestId, 400)
    }

    const result = await addCampaignRecipients(campaignId, body.patient_ids)

    return apiSuccess(result)
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

export const POST = withModuleRoute('followup')(handlePOST)
