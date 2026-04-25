import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'

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

    const supabase = await createTypedClient()

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
      const { data: currentLead } = await supabase
        .from('leads')
        .select('id, updated_at')
        .eq('id', id)
        .eq('clinic_id', profile.clinic_id)
        .single()

      if (currentLead && currentLead.updated_at && version !== currentLead.updated_at) {
        // Client version doesn't match server version - concurrent modification detected
        return NextResponse.json(
          {
            error: 'Lead was modified by another user',
            conflict: true,
            currentState: currentLead
          },
          { status: 409 }
        )
      }
    }

    // Update lead's stage
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .update({ stage_id, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('clinic_id', profile.clinic_id)
      .select()
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json({ data: lead })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
