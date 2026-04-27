import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { getContactTimeline } from '@/services/contacts/timeline.service'
import type { TimelineSourceType } from '@/services/contacts/timeline.service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const clinicId = auth.profile!.clinic_id
  const { id } = await params
  const { searchParams } = new URL(request.url)

  const type = searchParams.get('type') as 'patient' | 'lead'
  const cursor = searchParams.get('cursor') || undefined
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20
  const source = searchParams.get('source') as TimelineSourceType | null

  if (!type) {
    return NextResponse.json({ error: 'type query parameter required' }, { status: 400 })
  }

  try {
    const timeline = await getContactTimeline(clinicId, id, type, {
      cursor,
      limit,
      typeFilter: source || undefined,
    })

    return NextResponse.json(timeline)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 })
  }
}