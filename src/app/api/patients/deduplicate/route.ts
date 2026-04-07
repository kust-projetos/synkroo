import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'
import { detectDuplicates, mergePatients } from '@/services/patients/patient-dedup.service'

/**
 * GET /api/patients/deduplicate
 * Detect duplicate patient records
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
    const duplicates = await detectDuplicates(clinicId)

    return NextResponse.json({ duplicates, total: duplicates.length })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/patients/deduplicate
 * Merge duplicate patient records
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
    const { primaryId, secondaryId } = body as {
      primaryId: string
      secondaryId: string
    }

    if (!primaryId || !secondaryId) {
      return NextResponse.json(
        { error: 'Missing required fields: primaryId, secondaryId' },
        { status: 400 }
      )
    }

    const result = await mergePatients(primaryId, secondaryId, clinicId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
