import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/supabase/server'
import {
  listBudgets,
  createBudget,
  getBudgetStats,
  type CreateBudgetInput,
} from '@/services/budgets/budget.service'
import type { BudgetItem } from '@/lib/supabase/database.types'
import { createBudgetSchema } from '@/lib/validations'
import { apiLogger } from '@/lib/logger'

/**
 * GET /api/budgets
 * List budgets with optional filters
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
    const patientId = searchParams.get('patient_id') || undefined
    const status = searchParams.get('status') as 'pending' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted' | undefined
    const fromDate = searchParams.get('from_date') || undefined
    const toDate = searchParams.get('to_date') || undefined
    const statsOnly = searchParams.get('stats') === 'true'

    if (statsOnly) {
      const stats = await getBudgetStats(clinicId)
      return NextResponse.json({ stats })
    }

    const budgets = await listBudgets({
      clinic_id: clinicId,
      patient_id: patientId,
      status,
      from_date: fromDate,
      to_date: toDate,
    })

    return NextResponse.json({ budgets })
  } catch (error) {
    apiLogger.error('Error listing budgets', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/budgets
 * Create a new budget
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
    const { patient_id, appointment_id, title, description, items, discount_percent, discount_value, valid_until, notes } = createBudgetSchema.parse(rawBody)

    const input: CreateBudgetInput = {
      clinic_id: clinicId,
      patient_id,
      appointment_id,
      title,
      description,
      items: items as BudgetItem[],
      discount_percent,
      discount_value,
      valid_until,
      notes,
      created_by: userId,
    }

    const budget = await createBudget(input)

    return NextResponse.json({ budget }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    apiLogger.error('Error creating budget', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
