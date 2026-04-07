import { NextRequest, NextResponse } from 'next/server'
import {
  identifyInactivePatients,
  getInactivityStats,
  updateInactivePatientTags,
} from '@/services/followup/inactive-patient.service'
import { validateApiAuth, hasRequiredRole } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'

/**
 * GET /api/patients/inactive?min_days=30&stats_only=true
 * List inactive patients for authenticated user's clinic
 * Requires: owner, admin, or dentist role
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin', 'dentist'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const minDays = parseInt(searchParams.get('min_days') || '30')
    const statsOnly = searchParams.get('stats_only') === 'true'

    if (statsOnly) {
      const stats = await getInactivityStats(clinicId)
      return NextResponse.json({ stats })
    }

    const patients = await identifyInactivePatients(clinicId, minDays)

    return NextResponse.json({
      total: patients.length,
      patients,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/patients/inactive
 * Update patient tags with inactivity status
 * Requires: owner or admin role
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin'])) {
      return NextResponse.json(
        { error: 'Only owners and admins can update patient tags' },
        { status: 403 }
      )
    }

    const result = await updateInactivePatientTags(clinicId)

    return NextResponse.json({
      success: true,
      updated: result.updated,
      errors: result.errors,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
