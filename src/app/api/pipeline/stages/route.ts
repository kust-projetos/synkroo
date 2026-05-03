import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile, createClient } from '@/lib/supabase/server'

// GET /api/pipeline/stages -- list all stages for clinic
export async function GET(req: NextRequest) {
  try {
    const profile = await getUserProfile()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clinicId = profile.clinic_id
    if (!clinicId) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('sort_order', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: data ?? [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/pipeline/stages -- create new stage
export async function POST(req: NextRequest) {
  try {
    const profile = await getUserProfile()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, color, sort_order } = body

    if (!name || !color) {
      return NextResponse.json({ error: 'name and color are required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check for name conflict
    const { data: existing } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('clinic_id', profile.clinic_id)
      .eq('name', name)
      .single()

    if (existing) {
      return NextResponse.json({ error: `Stage with name "${name}" already exists` }, { status: 409 })
    }

    let sortOrder = sort_order
    if (sortOrder === undefined) {
      const { data: lastStage } = await supabase
        .from('pipeline_stages')
        .select('sort_order')
        .eq('clinic_id', profile.clinic_id)
        .order('sort_order', { ascending: false })
        .limit(1)

      sortOrder = (lastStage?.[0]?.sort_order ?? -1) + 1
    }

    const { data, error } = await supabase
      .from('pipeline_stages')
      .insert({
        clinic_id: profile.clinic_id,
        name,
        color,
        sort_order: sortOrder,
        is_default: false,
        is_system: false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}