import { NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { dbLogger } from '@/lib/logger'
import { getLeadStats } from '@/services/leads/leads.service'

/**
 * GET /api/leads/stats
 * Get lead statistics for dashboard
 */
export async function GET() {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const stats = await getLeadStats(clinicId)

    return NextResponse.json(stats)
  } catch (error) {
    dbLogger.error('Error fetching lead stats', error)
    return NextResponse.json({ error: 'Failed to fetch lead stats' }, { status: 500 })
  }
}