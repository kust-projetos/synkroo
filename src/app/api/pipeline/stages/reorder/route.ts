import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { reorderPipelineStages } from '@/services/pipeline/stages.service'

export async function PATCH(req: NextRequest) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })
    const clinicId = auth.profile!.clinic_id

    const body = await req.json()
    const { stages } = body
    if (!Array.isArray(stages)) return NextResponse.json({ error: 'stages array required' }, { status: 400 })

    try {
      if (stages.length > 0) await reorderPipelineStages(stages, clinicId)
    } catch (error: any) {
      if (error.message?.includes('do not belong to clinic')) return NextResponse.json({ error: error.message }, { status: 400 })
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
