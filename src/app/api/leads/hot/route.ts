import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { dbLogger } from '@/lib/logger'
import { getHotLeads } from '@/services/leads/leads.service'

/**
 * GET /api/leads/hot
 * Get hot leads for notifications
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
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    const hotLeads = await getHotLeads(clinicId, limit)

    return NextResponse.json({
      leads: hotLeads,
      count: hotLeads.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    dbLogger.error('Error fetching hot leads', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}