import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/leads/[id]/stage -- update lead's stage_id with version-based conflict detection
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await getUserProfile()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { stage_id, version } = body

    if (!stage_id) {
      return NextResponse.json({ error: 'stage_id is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify the stage belongs to the user's clinic
    const { data: stage, error: stageError } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('id', stage_id)
      .eq('clinic_id', profile.clinic_id)
      .single()

    if (stageError || !stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Version-based conflict detection (optimistic locking)
    if (version) {
      const result = await supabase
        .from('leads')
        .select('id, updated_at')
        .eq('id', id)
        .eq('clinic_id', profile.clinic_id)
        .single() as { data: { id: string; updated_at: string } | null }

      if (result.data && result.data.updated_at && version !== result.data.updated_at) {
        // Client version doesn't match server version - concurrent modification detected
        return NextResponse.json(
          {
            error: 'Lead was modified by another user',
            conflict: true,
            currentState: result.data
          },
          { status: 409 }
        )
      }
    }

    // Update lead's stage
    const leadResult = await supabase
      .from('leads')
      .update({ stage_id, updated_at: new Date().toISOString() } as never)
      .eq('id', id)
      .eq('clinic_id', profile.clinic_id)
      .select()
      .single() as { data: { id: string; stage_id: string } | null; error: null }

    if (leadResult.error || !leadResult.data) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json({ data: leadResult.data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
