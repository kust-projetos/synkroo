import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { convertLeadToPatient } from '@/services/leads/leads.service'

// POST /api/leads/[id]/convert -- convert lead to patient
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })

    const { id } = await params
    const body = await req.json()
    const { patient_id } = body

    if (!patient_id) {
      return NextResponse.json({ error: 'patient_id is required' }, { status: 400 })
    }

    const success = await convertLeadToPatient(id, patient_id)

    if (!success) {
      return NextResponse.json({ error: 'Conversion failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { lead_id: id, patient_id } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}