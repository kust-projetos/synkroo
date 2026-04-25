import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile } from '@/lib/supabase/server'
import { getPipelineStages, createPipelineStage } from '@/services/pipeline/stages.service'

// GET /api/pipeline/stages -- list all stages for clinic
export async function GET(req: NextRequest) {
  try {
    const profile = await getUserProfile()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clinicId = profile.clinic_id
    if (!clinicId) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

    const stages = await getPipelineStages(clinicId)
    return NextResponse.json({ data: stages })
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

    const stage = await createPipelineStage({
      clinicId: profile.clinic_id,
      name,
      color,
      sortOrder: sort_order,
    })

    return NextResponse.json({ data: stage }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}