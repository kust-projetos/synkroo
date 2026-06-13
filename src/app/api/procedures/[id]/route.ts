import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError, NotFoundError } from '@/lib/errors'
import * as procedureRepo from '@/repositories/procedures'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/procedures/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params

    const procedure = await procedureRepo.findById(id)
    if (!procedure || procedure.clinicId !== clinicId) {
      return handleApiError(new NotFoundError('Procedure not found'))
    }

    return NextResponse.json({ procedure })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PATCH /api/procedures/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params

    const existing = await procedureRepo.findById(id)
    if (!existing || existing.clinicId !== clinicId) {
      return handleApiError(new NotFoundError('Procedure not found'))
    }

    const body = await request.json()
    const procedure = await procedureRepo.update(id, body)
    return NextResponse.json({ procedure })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/procedures/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params

    const existing = await procedureRepo.findById(id)
    if (!existing || existing.clinicId !== clinicId) {
      return handleApiError(new NotFoundError('Procedure not found'))
    }

    await procedureRepo.remove(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
