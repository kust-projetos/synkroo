import { NextRequest, NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { getEffectiveConfig, replacePlaceholders } from '@/services/reminders/procedure-reminder-config.service'
import { handleApiError } from '@/lib/errors'
import { getDb } from '@/lib/db/client'
import { appointments, patients, dentists, procedures, clinics } from '@/lib/db/schema'

function formatAppointmentsQuery(db: ReturnType<typeof getDb>, id: string) {
  return db
    .select({
      id: appointments.id,
      scheduledAt: appointments.scheduledAt,
      patient: { id: patients.id, name: patients.name, phone: patients.phone },
      dentist: { name: dentists.name },
      procedure: { id: procedures.id, name: procedures.name },
      clinic: { id: clinics.id, name: clinics.name, phone: clinics.phone },
    })
    .from(appointments)
    .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
    .leftJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(dentists, eq(dentists.id, appointments.dentistId))
    .leftJoin(procedures, eq(procedures.id, appointments.procedureId))
    .where(eq(appointments.id, id))
    .limit(1)
}

/**
 * GET /api/appointments/[id]/reminder-template
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params

    const db = getDb()
    const rows = await formatAppointmentsQuery(db, id)
    if (rows.length === 0) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })

    const apt = rows[0]
    if (apt.clinic.id !== clinicId) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const procedureTypeId = apt.procedure?.id || ''
    const procedureTypeName = apt.procedure?.name || ''
    const config = await getEffectiveConfig(clinicId, procedureTypeId, procedureTypeName)

    const scheduledAt = new Date(apt.scheduledAt)
    const filledMessage = replacePlaceholders(config.message_template, {
      paciente_nome: apt.patient?.name || '',
      data: scheduledAt.toLocaleDateString('pt-BR'),
      horario: scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      dentista: apt.dentist?.name || '',
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
 * POST /api/appointments/[id]/reminder-template (preview)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params

    const db = getDb()
    const rows = await formatAppointmentsQuery(db, id)
    if (rows.length === 0) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })

    const apt = rows[0]
    if (apt.clinic.id !== clinicId) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const procedureTypeName = apt.procedure?.name || ''
    const config = await getEffectiveConfig(clinicId, apt.procedure?.id || '', procedureTypeName)

    const scheduledAt = new Date(apt.scheduledAt)
    const filledMessage = replacePlaceholders(config.message_template, {
      paciente_nome: apt.patient?.name || '',
      data: scheduledAt.toLocaleDateString('pt-BR'),
      horario: scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      dentista: apt.dentist?.name || '',
      procedimento: procedureTypeName,
    })

    return NextResponse.json({
      preview: {
        original_template: config.message_template,
        filled_message: filledMessage,
        placeholders: {
          paciente_nome: apt.patient?.name || '',
          data: scheduledAt.toLocaleDateString('pt-BR'),
          horario: scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          dentista: apt.dentist?.name || '',
          procedimento: procedureTypeName,
        },
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
