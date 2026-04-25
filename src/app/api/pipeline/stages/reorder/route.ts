import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile } from '@/lib/supabase/server'
import { reorderPipelineStages } from '@/services/pipeline/stages.service'

// PATCH /api/pipeline/stages/reorder -- bulk reorder stages
export async function PATCH(req: NextRequest) {
  try {
    const profile = await getUserProfile()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clinicId = profile.clinic_id
    if (!clinicId) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

    const body = await req.json()
    const { stages } = body

    if (!Array.isArray(stages)) {
      return NextResponse.json({ error: 'stages array required' }, { status: 400 })
    }

    // Validate stage IDs belong to user's clinic
    if (stages.length > 0) {
      try {
        await reorderPipelineStages(stages, clinicId)
      } catch (error: any) {
        if (error.message.includes('do not belong to clinic')) {
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
        throw error
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}