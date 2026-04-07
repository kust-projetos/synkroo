/**
 * Scheduler Tools for Synkroo Agent
 * Tools for appointment scheduling, rescheduling, and cancellation
 */

import type { Tool } from './base.tools'
import { dbLogger } from '@/lib/logger'
import { BASE_TOOLS } from './base.tools'

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Scheduler-specific tools (extends BASE_TOOLS)
 */
export const SCHEDULER_TOOLS: Tool[] = [
  ...BASE_TOOLS,
  {
    name: 'check_availability',
    description: 'Verifica disponibilidade de horários para uma data',
    inputSchema: {
      type: 'object',
      properties: {
        dentistId: { type: 'string', description: 'ID do dentista (opcional)' },
        date: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
        clinicId: { type: 'string', description: 'ID da clínica' },
        durationMinutes: { type: 'number', description: 'Duração em minutos (default 30)' },
      },
      required: ['date', 'clinicId'],
    },
  },
  {
    name: 'book_appointment',
    description: 'Agenda uma consulta',
    inputSchema: {
      type: 'object',
      properties: {
        clinicId: { type: 'string', description: 'ID da clínica' },
        patientId: { type: 'string', description: 'ID do paciente' },
        dentistId: { type: 'string', description: 'ID do dentista (opcional)' },
        procedureId: { type: 'string', description: 'ID do procedimento (opcional)' },
        date: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
        time: { type: 'string', description: 'Horário no formato HH:MM' },
        notes: { type: 'string', description: 'Observações (opcional)' },
      },
      required: ['clinicId', 'patientId', 'date', 'time'],
    },
  },
  {
    name: 'cancel_appointment',
    description: 'Cancela uma consulta',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'ID da consulta' },
        reason: { type: 'string', description: 'Motivo do cancelamento (opcional)' },
      },
      required: ['appointmentId'],
    },
  },
  {
    name: 'reschedule_appointment',
    description: 'Remarca uma consulta para nova data/horário',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'ID da consulta' },
        newDate: { type: 'string', description: 'Nova data no formato YYYY-MM-DD' },
        newTime: { type: 'string', description: 'Novo horário no formato HH:MM' },
        reason: { type: 'string', description: 'Motivo da remarcação (opcional)' },
      },
      required: ['appointmentId', 'newDate', 'newTime'],
    },
  },
]

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Check availability for a date/dentist
 */
export async function checkAvailabilityTool(
  dentistId: string | undefined,
  date: string,
  clinicId: string,
  durationMinutes: number = 30
): Promise<{
  success: boolean
  data?: {
    date: string
    slots: Array<{
      time: string
      available: boolean
      dentistName?: string
    }>
  }
  error?: string
}> {
  try {
    const { getAvailableSlots } = await import('@/services/scheduler/scheduler.service')

    const slots = await getAvailableSlots(clinicId, date, durationMinutes, dentistId)

    return {
      success: true,
      data: {
        date,
        slots,
      },
    }
  } catch (error) {
    dbLogger.error('checkAvailabilityTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao verificar disponibilidade',
    }
  }
}

/**
 * Book an appointment
 */
export async function bookAppointmentTool(
  clinicId: string,
  patientId: string,
  dentistId: string | undefined,
  procedureId: string | undefined,
  date: string,
  time: string,
  notes?: string
): Promise<{
  success: boolean
  data?: {
    appointmentId: string
    message: string
  }
  error?: string
}> {
  try {
    const { createTypedClient } = await import('@/lib/supabase/typed')

    const supabase = await createTypedClient()

    // Combine date and time
    const scheduledAt = new Date(`${date}T${time}:00`)

    // Create the appointment
    const { data: appointment, error } = await (supabase
      .from('appointments') as any)
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        dentist_id: dentistId || null,
        procedure_id: procedureId || null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: 30,
        status: 'scheduled',
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      dbLogger.error('bookAppointmentTool error', error)
      return {
        success: false,
        error: 'Não foi possível criar o agendamento',
      }
    }

    const dateStr = scheduledAt.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    })
    const timeStr = scheduledAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    return {
      success: true,
      data: {
        appointmentId: appointment.id,
        message: `Agendamento confirmado!\n\nData: ${dateStr}\nHorário: às ${timeStr}\n\nVocê receberá um lembrete por WhatsApp.`,
      },
    }
  } catch (error) {
    dbLogger.error('bookAppointmentTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao agendar consulta',
    }
  }
}

/**
 * Cancel an appointment
 */
export async function cancelAppointmentTool(
  appointmentId: string,
  reason?: string
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    const { createTypedClient } = await import('@/lib/supabase/typed')

    const supabase = await createTypedClient()

    const { error } = await (supabase
      .from('appointments') as any)
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)

    if (error) {
      dbLogger.error('cancelAppointmentTool error', error)
      return {
        success: false,
        error: 'Não foi possível cancelar o agendamento',
      }
    }

    return {
      success: true,
      message: 'Agendamento cancelado com sucesso.',
    }
  } catch (error) {
    dbLogger.error('cancelAppointmentTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao cancelar consulta',
    }
  }
}

/**
 * Reschedule an appointment
 */
export async function rescheduleAppointmentTool(
  appointmentId: string,
  newDate: string,
  newTime: string,
  reason?: string
): Promise<{
  success: boolean
  data?: {
    appointmentId: string
    message: string
  }
  error?: string
}> {
  try {
    const { createTypedClient } = await import('@/lib/supabase/typed')

    const supabase = await createTypedClient()

    // Get current appointment to preserve other data
    const { data: currentAppointment, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single() as any

    if (fetchError || !currentAppointment) {
      return {
        success: false,
        error: 'Agendamento não encontrado',
      }
    }

    // Calculate new scheduled time
    const newScheduledAt = new Date(`${newDate}T${newTime}:00`)

    // Update appointment
    const { error: updateError } = await (supabase
      .from('appointments') as any)
      .update({
        scheduled_at: newScheduledAt.toISOString(),
        status: 'scheduled',
        rescheduled_at: new Date().toISOString(),
        reschedule_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)

    if (updateError) {
      dbLogger.error('rescheduleAppointmentTool error', updateError)
      return {
        success: false,
        error: 'Não foi possível remarcar o agendamento',
      }
    }

    const dateStr = newScheduledAt.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    })
    const timeStr = newScheduledAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    return {
      success: true,
      data: {
        appointmentId,
        message: `Agendamento remarcado!\n\nNova data: ${dateStr}\nNovo horário: às ${timeStr}\n\nVocê receberá um lembrete atualizado por WhatsApp.`,
      },
    }
  } catch (error) {
    dbLogger.error('rescheduleAppointmentTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao remarcar consulta',
    }
  }
}

// ============================================================================
// Tool Executor Registry
// ============================================================================

/**
 * Registry mapping scheduler tool names to their implementations
 */
export const SCHEDULER_TOOL_IMPLEMENTATIONS: Record<string, any> = {
  check_availability: async (args: {
    dentistId?: string
    date: string
    clinicId: string
    durationMinutes?: number
  }) => checkAvailabilityTool(args.dentistId, args.date, args.clinicId, args.durationMinutes),

  book_appointment: async (args: {
    clinicId: string
    patientId: string
    dentistId?: string
    procedureId?: string
    date: string
    time: string
    notes?: string
  }) => bookAppointmentTool(
    args.clinicId,
    args.patientId,
    args.dentistId,
    args.procedureId,
    args.date,
    args.time,
    args.notes
  ),

  cancel_appointment: async (args: { appointmentId: string; reason?: string }) =>
    cancelAppointmentTool(args.appointmentId, args.reason),

  reschedule_appointment: async (args: {
    appointmentId: string
    newDate: string
    newTime: string
    reason?: string
  }) => rescheduleAppointmentTool(args.appointmentId, args.newDate, args.newTime, args.reason),
}
