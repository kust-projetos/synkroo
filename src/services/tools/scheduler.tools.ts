/**
 * Scheduler Tools for Synkroo Agent
 * Tools for appointment scheduling, rescheduling, and cancellation
 * Migrated from Supabase to Drizzle ORM.
 */

import type { Tool } from './base.tools'
import { dbLogger } from '@/lib/logger'
import { BASE_TOOLS } from './base.tools'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { appointments } from '@/lib/db/schema'

// ============================================================================
// Tool Definitions
// ============================================================================

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

export async function checkAvailabilityTool(
  dentistId: string | undefined,
  date: string,
  clinicId: string,
  durationMinutes: number = 30
): Promise<{
  success: boolean
  data?: { date: string; slots: Array<{ time: string; available: boolean; dentistName?: string }> }
  error?: string
}> {
  try {
    const { getAvailableSlots } = await import('@/services/scheduler/scheduler.service')
    const slots = await getAvailableSlots(clinicId, date, durationMinutes, dentistId)
    return { success: true, data: { date, slots } }
  } catch (error) {
    dbLogger.error('checkAvailabilityTool error', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao verificar disponibilidade' }
  }
}

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
  data?: { appointmentId: string; message: string }
  error?: string
}> {
  try {
    const db = getDb()
    const scheduledAt = new Date(`${date}T${time}:00`)

    const [appointment] = await db.insert(appointments).values({
      clinicId,
      patientId,
      dentistId: dentistId ?? null,
      procedureId: procedureId ?? null,
      scheduledAt,
      durationMinutes: 30,
      status: 'scheduled' as any,
      notes: notes ?? null,
    }).returning()

    if (!appointment) {
      return { success: false, error: 'Não foi possível criar o agendamento' }
    }

    const dateStr = scheduledAt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const timeStr = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    return {
      success: true,
      data: {
        appointmentId: appointment.id,
        message: `Agendamento confirmado!\n\nData: ${dateStr}\nHorário: às ${timeStr}\n\nVocê receberá um lembrete por WhatsApp.`,
      },
    }
  } catch (error) {
    dbLogger.error('bookAppointmentTool error', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao agendar consulta' }
  }
}

export async function cancelAppointmentTool(
  appointmentId: string,
  reason?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const db = getDb()

    await db.update(appointments)
      .set({
        status: 'cancelled' as any,
        cancelledAt: new Date(),
        cancellationReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId))

    return { success: true, message: 'Agendamento cancelado com sucesso.' }
  } catch (error) {
    dbLogger.error('cancelAppointmentTool error', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao cancelar consulta' }
  }
}

export async function rescheduleAppointmentTool(
  appointmentId: string,
  newDate: string,
  newTime: string,
  reason?: string
): Promise<{
  success: boolean
  data?: { appointmentId: string; message: string }
  error?: string
}> {
  try {
    const db = getDb()

    // Get current appointment to verify existence
    const [current] = await db.select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1)

    if (!current) {
      return { success: false, error: 'Agendamento não encontrado' }
    }

    const newScheduledAt = new Date(`${newDate}T${newTime}:00`)

    await db.update(appointments)
      .set({
        scheduledAt: newScheduledAt,
        status: 'scheduled' as any,
        rescheduledAt: new Date(),
        rescheduleReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId))

    const dateStr = newScheduledAt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const timeStr = newScheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    return {
      success: true,
      data: {
        appointmentId,
        message: `Agendamento remarcado!\n\nNova data: ${dateStr}\nNovo horário: às ${timeStr}\n\nVocê receberá um lembrete atualizado por WhatsApp.`,
      },
    }
  } catch (error) {
    dbLogger.error('rescheduleAppointmentTool error', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao remarcar consulta' }
  }
}

// ============================================================================
// Tool Executor Registry
// ============================================================================

export const SCHEDULER_TOOL_IMPLEMENTATIONS: Record<string, any> = {
  check_availability: async (args: { dentistId?: string; date: string; clinicId: string; durationMinutes?: number }) =>
    checkAvailabilityTool(args.dentistId, args.date, args.clinicId, args.durationMinutes),

  book_appointment: async (args: { clinicId: string; patientId: string; dentistId?: string; procedureId?: string; date: string; time: string; notes?: string }) =>
    bookAppointmentTool(args.clinicId, args.patientId, args.dentistId, args.procedureId, args.date, args.time, args.notes),

  cancel_appointment: async (args: { appointmentId: string; reason?: string }) =>
    cancelAppointmentTool(args.appointmentId, args.reason),

  reschedule_appointment: async (args: { appointmentId: string; newDate: string; newTime: string; reason?: string }) =>
    rescheduleAppointmentTool(args.appointmentId, args.newDate, args.newTime, args.reason),
}
