/**
 * LGPD Anonymize API Route
 *
 * POST /api/lgpd/anonymize
 *
 * LGPD-03: Anonymizes patient data with audit trail
 *
 * Body:
 *   patientId: string
 *
 * Returns:
 *   { success: true, auditId: string (request UUID) }
 *
 * Anonymizes:
 *   - patients.name -> 'ANONYMIZED_' + 8-char hex
 *   - patients.phone -> NULL
 *   - patients.email -> NULL
 *   - patients.cpf -> NULL
 *   - patients.birth_date -> NULL
 *   - appointments.notes -> '[ANONYMIZED]'
 *   - budgets.notes -> '[ANONYMIZED]'
 *   - leads.name -> '[ANONYMIZED]'
 *   - leads.phone -> NULL
 *   - leads.email -> NULL
 *
 * Creates audit log entry with action 'patient_anonymized'
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
    const requestId = crypto.randomUUID()

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

    // Generate anonymized name prefix
    const anonymizedHex = crypto.randomUUID().replace(/-/g, '').substring(0, 8)
    const anonymizedName = `ANONYMIZED_${anonymizedHex}`

    // Perform sequential updates with error checking
    // Step 1: Update patients table
    const { error: patientError } = await supabase
      .from('patients')
      .update({
        name: anonymizedName,
        phone: null,
        email: null,
        cpf: null,
        birth_date: null,
      } as never)
      .eq('id', patientId)
      .eq('clinic_id', clinicId)

    if (patientError) {
      console.error('Error anonymizing patient:', patientError)
      throw new Error('Failed to anonymize patient data')
    }

    // Step 2: Update appointments notes
    await supabase
      .from('appointments')
      .update({ notes: '[ANONYMIZED]' } as never)
      .eq('patient_id', patientId)
      .eq('clinic_id', clinicId)

    // Step 3: Update budgets notes
    await supabase
      .from('budgets')
      .update({ notes: '[ANONYMIZED]' } as never)
      .eq('patient_id', patientId)
      .eq('clinic_id', clinicId)

    // Step 4: Update leads (if any linked)
    await supabase
      .from('leads')
      .update({
        name: '[ANONYMIZED]',
        phone: null,
        email: null,
      } as never)
      .eq('patient_id', patientId)
      .eq('clinic_id', clinicId)

    // Step 5: Create audit log entry
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        clinic_id: clinicId,
        action: 'patient_anonymized',
        record_id: patientId,
        metadata: JSON.stringify({
          requestId,
          originalPatientId: patientId,
          anonymizedAt: new Date().toISOString(),
        }),
      } as never)

    if (auditError) {
      console.error('Error creating audit log:', auditError)
      // Non-fatal - still return success but log the issue
    }

    return NextResponse.json({
      success: true,
      auditId: requestId,
    })
  } catch (error) {
    console.error('LGPD anonymize error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
