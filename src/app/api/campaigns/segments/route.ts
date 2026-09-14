import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { withModuleRoute } from '@/core/modules/gates'
import {
  createSegment,
  previewSegmentSize,
  getSegmentPatients,
  listSegments,
  type SegmentCriteria,
} from '@/services/followup/segmentation.service'

/**
 * GET /api/campaigns/segments
 * List saved segments or preview criteria
 */
async function handleGET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('followup:manage_segments')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const clinicId = authResult.profile!.clinic_id
    const searchParams = new URL(request.url).searchParams
    const preview = searchParams.get('preview') === 'true'

    if (preview) {
      const criteriaJson = searchParams.get('criteria')
      if (!criteriaJson) {
        return apiFailure('INVALID_INPUT', 'criteria parameter required for preview', requestId, 400)
      }

      const criteria: SegmentCriteria = JSON.parse(criteriaJson)
      const count = await previewSegmentSize(clinicId, criteria)
      return apiSuccess({ count })
    }

    const segments = await listSegments(clinicId)
    return apiSuccess({ segments })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

/**
 * POST /api/campaigns/segments
 * Create a new segment
 */
async function handlePOST(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('followup:manage_segments')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const clinicId = authResult.profile!.clinic_id
    const body = await request.json()
    const { name, description, criteria } = body as {
      name: string
      description?: string
      criteria: SegmentCriteria
    }

    if (!name || !criteria) {
      return apiFailure('INVALID_INPUT', 'Missing required fields: name, criteria', requestId, 400)
    }

    const segment = await createSegment({
      clinicId,
      name,
      description,
      criteria,
      createdBy: authResult.profile!.id,
    })

    if (!segment) {
      return apiFailure('INTERNAL_ERROR', 'Failed to create segment', requestId, 500)
    }

    return apiSuccess({ segment })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

export const GET = withModuleRoute('followup')(handleGET)
export const POST = withModuleRoute('followup')(handlePOST)
