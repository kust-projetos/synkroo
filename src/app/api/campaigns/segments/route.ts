import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
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
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const searchParams = new URL(request.url).searchParams
    const preview = searchParams.get('preview') === 'true'

    if (preview) {
      const criteriaJson = searchParams.get('criteria')
      if (!criteriaJson) {
        return NextResponse.json({ error: 'criteria parameter required for preview' }, { status: 400 })
      }

      const criteria: SegmentCriteria = JSON.parse(criteriaJson)
      const count = await previewSegmentSize(clinicId, criteria)
      return NextResponse.json({ count })
    }

    const segments = await listSegments(clinicId)
    return NextResponse.json({ segments })
  } catch (error) {
    console.error('Error fetching segments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/campaigns/segments
 * Create a new segment
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const body = await request.json()
    const { name, description, criteria } = body as {
      name: string
      description?: string
      criteria: SegmentCriteria
    }

    if (!name || !criteria) {
      return NextResponse.json(
        { error: 'Missing required fields: name, criteria' },
        { status: 400 }
      )
    }

    const segment = await createSegment({
      clinicId,
      name,
      description,
      criteria,
      createdBy: authResult.profile!.id,
    })

    if (!segment) {
      return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 })
    }

    return NextResponse.json({ segment })
  } catch (error) {
    console.error('Error creating segment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
