import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/auth/session'
import {
  getTreatmentPlansByPatient,
  createTreatmentPlan,
} from '@/services/treatment-plans/treatment-plan.service'
import { handleApiError, ValidationError } from '@/lib/errors'

const createTreatmentPlanSchema = z.object({
  patient_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  total_sessions: z.number().int().positive(),
  started_at: z.string().datetime().optional(),
  expected_completion_at: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    procedure_id: z.string().uuid().optional().nullable(),
    procedure_name: z.string().min(1),
    session_number: z.number().int().positive().optional(),
    appointment_id: z.string().uuid().optional().nullable(),
    scheduled_at: z.string().datetime().optional(),
    notes: z.string().optional(),
  })).optional().default([]),
})

/**
 * GET /api/treatment-plans
 * List treatment-plans for a patient
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }
    const clinicId = authResult.profile!.clinic_id

    const searchParams = request.nextUrl.searchParams
    const patientId = searchParams.get('patient_id')

    if (!patientId) {
      return NextResponse.json({ error: 'patient_id is required' }, { status: 400 })
    }

    const plans = await getTreatmentPlansByPatient(patientId, clinicId)

    return NextResponse.json({ treatment_plans: plans })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/treatment-plans
 * Create a new treatment-plan
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }
    const clinicId = authResult.profile!.clinic_id
    const userId = authResult.profile!.id

    const rawBody = await request.json()
    const body = createTreatmentPlanSchema.parse(rawBody)

    const plan = await createTreatmentPlan({
      clinic_id: clinicId,
      patient_id: body.patient_id,
      title: body.title,
      description: body.description,
      total_sessions: body.total_sessions,
      started_at: body.started_at,
      expected_completion_at: body.expected_completion_at,
      notes: body.notes,
      created_by: userId,
      items: body.items.map((item, index) => ({
        ...item,
        session_number: item.session_number ?? index + 1,
        status: 'pending',
      })),
    })

    return NextResponse.json({ treatment_plan: plan }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}