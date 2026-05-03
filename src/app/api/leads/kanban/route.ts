import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/leads/kanban
 * Kanban leads query for CRM pipeline board
 * Uses getUserProfile() for auth (establishes session via cookies)
 * then createClient() for data query (carries auth context)
 */
export async function GET(req: NextRequest) {
  try {
    const profile = await getUserProfile()
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = profile.clinic_id
    const { searchParams } = new URL(req.url)
    const stageId = searchParams.get('stage_id')

    const supabase = await createClient()

    let query = supabase
      .from('leads')
      .select(`
        id, name, phone, email, source, temperature, score,
        stage_id, interest, last_contact_at, created_at, updated_at,
        pipeline_stages (id, name, color, sort_order)
      `)
      .eq('clinic_id', clinicId)
      .order('score', { ascending: false })

    if (stageId) {
      query = query.eq('stage_id', stageId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ leads: data ?? [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
