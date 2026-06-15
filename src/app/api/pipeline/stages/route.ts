import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { getPipelineStages, createPipelineStage } from '@/services/pipeline/stages.service'

export async function GET(req: NextRequest) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })
    const clinicId = auth.profile!.clinic_id

    const data = await getPipelineStages(clinicId)
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })
    const clinicId = auth.profile!.clinic_id

    const body = await req.json()
    const { name, color, sort_order } = body
    if (!name || !color) return NextResponse.json({ error: 'name and color are required' }, { status: 400 })

    try {
      const data = await createPipelineStage({ clinicId, name, color, sortOrder: sort_order })
      return NextResponse.json({ data }, { status: 201 })
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
      throw error
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
