import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { validateApiAuth, hasRequiredRole } from '@/lib/supabase/server'
import { getEffectiveConfig, replacePlaceholders } from '@/services/reminders/procedure-reminder-config.service'
import { handleApiError } from '@/lib/errors'

interface AppointmentWithDetails {
  id: string
  scheduled_at: string
  patients: { id: string; name: string; phone: string } | null
  dentists: { name: string } | null
  procedures: { id: string; name: string } | null
  clinics: { id: string; name: string; phone: string } | null
}

/**
 * GET /api/appointments/[id]/reminder-template
 * Get the reminder template for a specific appointment based on its procedure type
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }

    const { id } = await params
    const supabase = await createClient()

    // Fetch appointment with related data
    const { data: appointment, error } = await (supabase
      .from('appointments') as any)
      .select(`
        id,
        scheduled_at,
        patients (id, name, phone),
        dentists (name),
        procedures (id, name),
        clinics!inner (id, name, phone)
      `)
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    }

    const apt = appointment as AppointmentWithDetails
    const clinicId = authResult.profile!.clinic_id

    // Verify clinic access
    if (apt.clinics?.id !== clinicId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // Get effective config for this procedure type
    const procedureTypeId = apt.procedures?.id || ''
    const procedureTypeName = apt.procedures?.name || ''
    const config = await getEffectiveConfig(clinicId, procedureTypeId, procedureTypeName)

    // Format appointment data
    const scheduledAt = new Date(apt.scheduled_at)
    const dataStr = scheduledAt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const horarioStr = scheduledAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    // Replace placeholders
    const filledMessage = replacePlaceholders(config.message_template, {
      paciente_nome: apt.patients?.name || '',
      data: dataStr,
      horario: horarioStr,
      dentista: apt.dentists?.name || '',
      procedimento: procedureTypeName,
    })

    return NextResponse.json({
      template: {
        procedure_type: procedureTypeName,
        hours_before: config.hours_before,
        message_template: config.message_template,
        filled_message: filledMessage,
        enabled: config.enabled,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/appointments/[id]/reminder-template
 * Preview the filled template for an appointment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }

    const { id } = await params
    const supabase = await createClient()

    // Fetch appointment with related data
    const { data: appointment, error } = await (supabase
      .from('appointments') as any)
      .select(`
        id,
        scheduled_at,
        patients (id, name, phone),
        dentists (name),
        procedures (id, name),
        clinics!inner (id, name, phone)
      `)
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    }

    const apt = appointment as AppointmentWithDetails
    const clinicId = authResult.profile!.clinic_id

    // Verify clinic access
    if (apt.clinics?.id !== clinicId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // Get effective config for this procedure type
    const procedureTypeId = apt.procedures?.id || ''
    const procedureTypeName = apt.procedures?.name || ''
    const config = await getEffectiveConfig(clinicId, procedureTypeId, procedureTypeName)

    // Format appointment data
    const scheduledAt = new Date(apt.scheduled_at)
    const dataStr = scheduledAt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const horarioStr = scheduledAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    // Replace placeholders
    const filledMessage = replacePlaceholders(config.message_template, {
      paciente_nome: apt.patients?.name || '',
      data: dataStr,
      horario: horarioStr,
      dentista: apt.dentists?.name || '',
      procedimento: procedureTypeName,
    })

    return NextResponse.json({
      preview: {
        original_template: config.message_template,
        filled_message: filledMessage,
        placeholders: {
          paciente_nome: apt.patients?.name || '',
          data: dataStr,
          horario: horarioStr,
          dentista: apt.dentists?.name || '',
          procedimento: procedureTypeName,
        },
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}