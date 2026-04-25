import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { previewSegmentSize, getSegmentPatients } from '@/services/followup/segmentation.service'
import { handleApiError } from '@/lib/errors'

/**
 * GET /api/campaigns/segments/preview?type={type}
 * Preview audience size for a campaign type
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
    const campaignType = searchParams.get('type')

    if (!campaignType) {
      return NextResponse.json(
        { error: 'Campaign type is required' },
        { status: 400 }
      )
    }

    // Map campaign types to segment criteria
    let criteria: {
      lastVisitMin?: number
      lastVisitMax?: number
      birthdayThisWeek?: boolean
      status?: 'active' | 'inactive' | 'all'
    } = {}

    switch (campaignType) {
      case 'reactivation':
        // Inactive 30+ days
        criteria = { lastVisitMin: 30 }
        break
      case 'follow_up':
        // Recent procedure (visited within 30 days)
        criteria = { lastVisitMax: 30 }
        break
      case 'birthday':
        // Birthday this week
        criteria = { birthdayThisWeek: true }
        break
      case 'promotional':
        // All active patients
        criteria = { status: 'active' }
        break
      default:
        return NextResponse.json(
          { error: `Unknown campaign type: ${campaignType}` },
          { status: 400 }
        )
    }

    // Get patient count based on criteria
    let count = 0

    if (campaignType === 'birthday') {
      // Special handling for birthday - query patients with birthday this week
      const { createTypedClient } = await import('@/lib/supabase/typed')
      const supabase = await createTypedClient()

      const now = new Date()
      const currentDayOfWeek = now.getDay()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - currentDayOfWeek)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)

      const { data: patients } = await supabase
        .from('patients')
        .select('id, birth_date')
        .eq('clinic_id', clinicId)
        .is('deleted_at', null)
        .neq('birth_date', null)

      // Filter patients with birthday this week
      const birthdayPatients = (patients || []).filter((p: any) => {
        if (!p.birth_date) return false
        const birthDate = new Date(p.birth_date)
        const birthMonth = birthDate.getMonth()
        const birthDay = birthDate.getDate()

        // Check if birthday falls within this week
        const thisYearBirthday = new Date(now.getFullYear(), birthMonth, birthDay)
        const weekStart = startOfWeek.getDate()
        const weekEnd = endOfWeek.getDate()
        const weekMonth = startOfWeek.getMonth()

        return birthMonth === weekMonth && birthDay >= weekStart && birthDay <= weekEnd
      })

      count = birthdayPatients.length

    } else if (campaignType === 'promotional') {
      // All active patients (not inactive)
      const { createTypedClient } = await import('@/lib/supabase/typed')
      const supabase = await createTypedClient()

      const { count: activeCount } = await supabase
        .from('patients')
        .select('id', { count: 'exact' })
        .eq('clinic_id', clinicId)
        .neq('status', 'inactive')
        .is('deleted_at', null)

      count = activeCount || 0

    } else {
      // Use the segmentation service for other campaign types
      count = await previewSegmentSize(clinicId, criteria)
    }

    // Get sample of first 10 patients for preview
    const patients = await getSegmentPatients(clinicId, criteria, 10)

    return NextResponse.json({
      count,
      patients: patients.slice(0, 10),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
