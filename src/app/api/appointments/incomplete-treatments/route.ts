import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import {
  detectIncompleteTreatments,
  getIncompleteTreatmentAlerts,
} from '@/services/appointments/incomplete-treatment.service'

/**
 * GET /api/appointments/incomplete-treatments
 * Detect incomplete multi-session treatments
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
    const summary = searchParams.get('summary') === 'true'

    if (summary) {
      const alerts = await getIncompleteTreatmentAlerts(clinicId)
      return NextResponse.json(alerts)
    }

    const treatments = await detectIncompleteTreatments(clinicId)
    return NextResponse.json({ treatments })
  } catch (error) {
    console.error('Error detecting incomplete treatments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
