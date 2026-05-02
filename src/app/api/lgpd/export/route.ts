/**
 * LGPD Data Export API Route
 *
 * POST /api/lgpd/export
 *
 * LGPD-02: Provides patient data portability - aggregates and exports all patient data
 *
 * Body:
 *   patientId: string
 *
 * Returns:
 *   {
 *     exportedAt: string (ISO timestamp)
 *     patient: object (all patient fields)
 *     appointments: array (all patient appointments)
 *     budgets: array (all patient budgets)
 *     payments: array (all patient payments)
 *     consents: array (all patient consents)
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error?.message || 'Unauthorized' },
        { status: authResult.error?.status || 401 }
      )
    }

    const clinicId = authResult.profile!.clinic_id

    // Parse request body
    const body = await request.json()
    const { patientId } = body

    if (!patientId) {
      return NextResponse.json(
        { error: 'Missing required field: patientId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Fetch all patient data in parallel
    const [patientResult, appointmentsResult, budgetsResult, paymentsResult, consentsResult] = await Promise.all([
      supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .eq('clinic_id', clinicId)
        .single(),

      supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', patientId)
        .eq('clinic_id', clinicId),

      supabase
        .from('budgets')
        .select('*')
        .eq('patient_id', patientId)
        .eq('clinic_id', clinicId),

      supabase
        .from('payments')
        .select('*')
        .eq('patient_id', patientId)
        .eq('clinic_id', clinicId),

      supabase
        .from('consents')
        .select('*')
        .eq('patient_id', patientId)
        .eq('clinic_id', clinicId),
    ])

    // Return structured export
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      patient: patientResult.data || null,
      appointments: appointmentsResult.data || [],
      budgets: budgetsResult.data || [],
      payments: paymentsResult.data || [],
      consents: consentsResult.data || [],
    })
  } catch (error) {
    console.error('LGPD export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
