import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { patients } from '@/modules/operacional/schema'
import { eq, and, isNull, isNotNull, ne } from 'drizzle-orm'
import { previewSegmentSize, getSegmentPatients } from '@/services/followup/segmentation.service'

/**
 * GET /api/campaigns/segments/preview?type={type}
 * Preview audience size for a campaign type
 * Migrated from Supabase to Drizzle ORM.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status },
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const searchParams = new URL(request.url).searchParams
    const campaignType = searchParams.get('type')

    if (!campaignType) {
      return NextResponse.json({ error: 'Campaign type is required' }, { status: 400 })
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
        criteria = { lastVisitMin: 30 }
        break
      case 'follow_up':
        criteria = { lastVisitMax: 30 }
        break
      case 'birthday':
        criteria = { birthdayThisWeek: true }
        break
      case 'promotional':
        criteria = { status: 'active' }
        break
      default:
        return NextResponse.json({ error: `Unknown campaign type: ${campaignType}` }, { status: 400 })
    }

    let count = 0
    const db = getDb()

    if (campaignType === 'birthday') {
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)

      const patientRows = await db.select({
        id: patients.id,
        birthDate: patients.birthDate,
      })
        .from(patients)
        .where(and(
          eq(patients.clinicId, clinicId),
          isNull(patients.deletedAt),
          isNotNull(patients.birthDate),
        ))

      const weekMonth = startOfWeek.getMonth()
      const weekStartDay = startOfWeek.getDate()
      const weekEndDay = endOfWeek.getDate()

      count = patientRows.filter((p) => {
        if (!p.birthDate) return false
        const bd = new Date(p.birthDate)
        return bd.getMonth() === weekMonth &&
          bd.getDate() >= weekStartDay &&
          bd.getDate() <= weekEndDay
      }).length
    } else if (campaignType === 'promotional') {
      const activeRows = await db.select({ id: patients.id })
        .from(patients)
        .where(and(
          eq(patients.clinicId, clinicId),
          ne(patients.status, 'inactive'),
          isNull(patients.deletedAt),
        ))

      count = activeRows.length
    } else {
      count = await previewSegmentSize(clinicId, criteria)
    }

    // Get sample of first 10 patients for preview
    const patientsList = await getSegmentPatients(clinicId, criteria, 10)

    return NextResponse.json({ count, patients: patientsList.slice(0, 10) })
  } catch (error) {
    console.error('Campaign segments preview error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
