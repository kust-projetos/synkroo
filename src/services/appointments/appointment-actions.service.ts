import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger, whatsappLogger } from '@/lib/logger'
import { processWaitlistOnCancellation } from '@/services/waitlist/waitlist.service'

/**
 * Appointment Actions Service
 * Handles cancel, reschedule, confirm with side effects
 */

type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

interface AppointmentInfo {
  id: string
  clinicId: string
  patientId: string
  patientName: string
  patientPhone: string
  scheduledAt: Date
  durationMinutes: number
  status: AppointmentStatus
  dentistId?: string
  dentistName?: string
  procedureName?: string
}

/**
 * Get appointment info with related data
 */
export async function getAppointmentInfo(appointmentId: string): Promise<AppointmentInfo | null> {
  const supabase = await createTypedClient()

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      clinic_id,
      patient_id,
      dentist_id,
      scheduled_at,
      duration_minutes,
      status,
      patients (id, name, phone),
      dentists (name),
      procedures (name)
    `)
    .eq('id', appointmentId)
    .single() as any

  if (error || !data) {
    return null
  }

  // Extract patient data - handle both array and object from join
  const patientData = (data as any).patients as any
  const patient = Array.isArray(patientData) ? patientData[0] : patientData

  // Extract dentist data
  const dentistData = (data as any).dentists as any
  const dentistName = Array.isArray(dentistData) ? dentistData[0]?.name : dentistData?.name

  // Extract procedure data
  const procedureData = (data as any).procedures as any
  const procedureName = Array.isArray(procedureData) ? procedureData[0]?.name : procedureData?.name

  return {
    id: (data as any).id,
    clinicId: (data as any).clinic_id,
    patientId: (data as any).patient_id,
    patientName: patient?.name || '',
    patientPhone: patient?.phone || '',
    scheduledAt: new Date((data as any).scheduled_at),
    durationMinutes: (data as any).duration_minutes,
    status: (data as any).status,
    dentistId: (data as any).dentist_id || undefined,
    dentistName,
    procedureName,
  }
}

/**
 * Cancel appointment with notification
 */
export async function cancelAppointment(
  appointmentId: string,
  reason?: string,
  cancelledBy: 'patient' | 'clinic' | 'system' = 'clinic'
): Promise<{ success: boolean; error?: string; waitlistNotified?: number }> {
  const supabase = await createTypedClient()

  const appointment = await getAppointmentInfo(appointmentId)
  if (!appointment) {
    return { success: false, error: 'Appointment not found' }
  }

  if (!['scheduled', 'confirmed'].includes(appointment.status)) {
    return { success: false, error: 'Only scheduled or confirmed appointments can be cancelled' }
  }

  // Update appointment status
  const { error: updateError } = await (supabase
    .from('appointments') as any)
    .update({
      status: 'cancelled',
      notes: reason ? `Cancelado: ${reason}` : 'Cancelado',
    })
    .eq('id', appointmentId)

  if (updateError) {
    dbLogger.error('Error cancelling appointment', updateError)
    return { success: false, error: 'Failed to cancel appointment' }
  }

  // Log the cancellation
  dbLogger.info(`Appointment ${appointmentId} cancelled`, {
    patientName: appointment.patientName,
    reason,
    cancelledBy,
  })

  // Notify patient via WhatsApp
  if (cancelledBy === 'clinic') {
    await sendCancellationNotification(appointment, reason)
  }

  // Process waitlist - notify waiting patients
  const date = appointment.scheduledAt.toISOString().split('T')[0]
  const time = appointment.scheduledAt.toTimeString().substring(0, 5)

  const { notified } = await processWaitlistOnCancellation(
    appointment.clinicId,
    date,
    time,
    appointment.dentistId
  )

  return { success: true, waitlistNotified: notified }
}

/**
 * Reschedule appointment
 */
export async function rescheduleAppointment(
  appointmentId: string,
  newDate: string, // YYYY-MM-DD
  newTime: string, // HH:MM
  notifyPatient: boolean = true
): Promise<{ success: boolean; error?: string; newScheduledAt?: Date }> {
  const supabase = await createTypedClient()

  const appointment = await getAppointmentInfo(appointmentId)
  if (!appointment) {
    return { success: false, error: 'Appointment not found' }
  }

  if (!['scheduled', 'confirmed', 'cancelled'].includes(appointment.status)) {
    return { success: false, error: 'Apenas agendamentos agendados, confirmados ou cancelados podem ser remarcados' }
  }

  const newScheduledAt = new Date(`${newDate}T${newTime}:00`)

  // Validate new date is in the future
  if (newScheduledAt <= new Date()) {
    return { success: false, error: 'A nova data e horário devem ser no futuro' }
  }

  // Check for conflicts at new time via atomic RPC
  const { data: rescheduleResult, error: rpcError } = await (supabase as any).rpc(
    'reschedule_appointment_slot',
    {
      p_appointment_id:   appointmentId,
      p_clinic_id:        appointment.clinicId,
      p_dentist_id:       appointment.dentistId || null,
      p_scheduled_at:     newScheduledAt.toISOString(),
      p_duration_minutes: appointment.durationMinutes,
    }
  )

  if (rpcError) {
    dbLogger.error('Error rescheduling appointment', rpcError)
    return { success: false, error: 'Erro ao remarcar agendamento' }
  }

  if (!rescheduleResult.success) {
    return { success: false, error: rescheduleResult.error }
  }

  dbLogger.info(`Appointment ${appointmentId} rescheduled`, {
    patientName: appointment.patientName,
    newDate: newScheduledAt.toISOString(),
  })

  // Notify patient
  if (notifyPatient) {
    await sendRescheduleNotification(appointment, newScheduledAt)
  }

  return { success: true, newScheduledAt }
}

/**
 * Confirm appointment
 */
export async function confirmAppointment(
  appointmentId: string,
  confirmationSource: 'patient' | 'clinic' | 'whatsapp' = 'clinic'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createTypedClient()

  const appointment = await getAppointmentInfo(appointmentId)
  if (!appointment) {
    return { success: false, error: 'Appointment not found' }
  }

  if (appointment.status !== 'scheduled') {
    return { success: false, error: 'Only scheduled appointments can be confirmed' }
  }

  const { error: updateError } = await (supabase
    .from('appointments') as any)
    .update({ status: 'confirmed' })
    .eq('id', appointmentId)

  if (updateError) {
    dbLogger.error('Error confirming appointment', updateError)
    return { success: false, error: 'Failed to confirm appointment' }
  }

  dbLogger.info(`Appointment ${appointmentId} confirmed`, {
    patientName: appointment.patientName,
    confirmationSource,
  })

  return { success: true }
}

/**
 * Mark as no-show
 */
export async function markNoShow(
  appointmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createTypedClient()

  const appointment = await getAppointmentInfo(appointmentId)
  if (!appointment) {
    return { success: false, error: 'Appointment not found' }
  }

  if (!['scheduled', 'confirmed'].includes(appointment.status)) {
    return { success: false, error: 'Only scheduled or confirmed appointments can be marked as no-show' }
  }

  const { error: updateError } = await (supabase
    .from('appointments') as any)
    .update({ status: 'no_show' })
    .eq('id', appointmentId)

  if (updateError) {
    dbLogger.error('Error marking no-show', updateError)
    return { success: false, error: 'Failed to mark as no-show' }
  }

  // Update patient's no-show count
  const { data: patient } = await supabase
    .from('patients')
    .select('no_show_count, risk_score')
    .eq('id', appointment.patientId)
    .single() as any

  if (patient) {
    const newNoShowCount = ((patient as any).no_show_count || 0) + 1
    // Increase risk score for no-shows
    const newRiskScore = Math.min(100, ((patient as any).risk_score || 0) + 10)

    await (supabase
      .from('patients') as any)
      .update({
        no_show_count: newNoShowCount,
        risk_score: newRiskScore,
      })
      .eq('id', appointment.patientId)
  }

  dbLogger.info(`Appointment ${appointmentId} marked as no-show`, {
    patientName: appointment.patientName,
  })

  return { success: true }
}

/**
 * Reactivate a cancelled appointment (move back to scheduled)
 */
export async function reactivateAppointment(
  appointmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createTypedClient()

  const appointment = await getAppointmentInfo(appointmentId)
  if (!appointment) {
    return { success: false, error: 'Appointment not found' }
  }

  if (appointment.status !== 'cancelled') {
    return { success: false, error: 'Only cancelled appointments can be reactivated' }
  }

  // Validate original appointment time is still in the future
  if (appointment.scheduledAt <= new Date()) {
    return { success: false, error: 'Original appointment time has passed. Please reschedule instead.' }
  }

  // Update appointment status back to scheduled
  const { error: updateError } = await (supabase
    .from('appointments') as any)
    .update({ status: 'scheduled' })
    .eq('id', appointmentId)

  if (updateError) {
    dbLogger.error('Error reactivating appointment', updateError)
    return { success: false, error: 'Failed to reactivate appointment' }
  }

  dbLogger.info(`Appointment ${appointmentId} reactivated (moved from cancelled to scheduled)`, {
    patientName: appointment.patientName,
  })

  return { success: true }
}

/**
 * Send cancellation notification to patient
 */
async function sendCancellationNotification(
  appointment: AppointmentInfo,
  reason?: string
): Promise<void> {
  const whatsappApiUrl = process.env.WHATSAPP_API_URL
  const whatsappToken = process.env.WHATSAPP_TOKEN

  if (!whatsappApiUrl || !whatsappToken || !appointment.patientPhone) {
    return
  }

  const dateStr = appointment.scheduledAt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const timeStr = appointment.scheduledAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const message = `🏥 *Consulta Cancelada*

Olá, ${appointment.patientName}.

Sua consulta agendada para ${dateStr} às ${timeStr} foi cancelada.
${reason ? `Motivo: ${reason}` : ''}

Para reagendar, responda esta mensagem ou entre em contato conosco.`

  try {
    let formattedPhone = appointment.patientPhone.replace(/\D/g, '')
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone
    }

    await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: { body: message },
      }),
    })

    whatsappLogger.info(`Cancellation notification sent to ${appointment.patientName}`)
  } catch (error) {
    whatsappLogger.error('Error sending cancellation notification', error)
  }
}

/**
 * Send reschedule notification to patient
 */
async function sendRescheduleNotification(
  appointment: AppointmentInfo,
  newScheduledAt: Date
): Promise<void> {
  const whatsappApiUrl = process.env.WHATSAPP_API_URL
  const whatsappToken = process.env.WHATSAPP_TOKEN

  if (!whatsappApiUrl || !whatsappToken || !appointment.patientPhone) {
    return
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

  const message = `🏥 *Consulta Reagendada*

Olá, ${appointment.patientName}.

Sua consulta foi reagendada:

📅 *Nova Data:* ${dateStr}
⏰ *Horário:* ${timeStr}
${appointment.dentistName ? `👨‍⚕️ Dr(a). ${appointment.dentistName}` : ''}
${appointment.procedureName ? `🦷 ${appointment.procedureName}` : ''}

Você receberá um lembrete no dia anterior. Até logo!`

  try {
    let formattedPhone = appointment.patientPhone.replace(/\D/g, '')
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone
    }

    await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: { body: message },
      }),
    })

    whatsappLogger.info(`Reschedule notification sent to ${appointment.patientName}`)
  } catch (error) {
    whatsappLogger.error('Error sending reschedule notification', error)
  }
}