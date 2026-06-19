import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { updatePipelineStage, deletePipelineStage } from '@/services/pipeline/stages.service'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })

    const { id } = await params
    const body = await req.json()
    const { name, color, sort_order } = body

    try {
      const stage = await updatePipelineStage(id, { name, color, sort_order })
      return NextResponse.json({ data: stage })
    } catch (error: any) {
      if (error.message === 'Cannot update default stage') {
        return NextResponse.json({ error: 'Cannot update default stage' }, { status: 403 })
      }
      throw error
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })

    const { id } = await params

    try {
      await deletePipelineStage(id)
      return NextResponse.json({ success: true })
    } catch (error: any) {
      if (error.message === 'Cannot delete default stage') return NextResponse.json({ error: error.message }, { status: 400 })
      if (error.message?.includes('Cannot delete stage with leads')) return NextResponse.json({ error: error.message }, { status: 400 })
      if (error.message?.includes('no default stage configured')) return NextResponse.json({ error: error.message }, { status: 400 })
      throw error
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
