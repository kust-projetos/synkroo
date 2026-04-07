import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger, whatsappLogger } from '@/lib/logger'

/**
 * Waitlist Service
 * Manages patient waitlists for unavailable appointment slots
 */

export interface WaitlistEntry {
  id: string
  clinicId: string
  patientId: string
  patientName: string
  patientPhone: string
  preferredDate: string // YYYY-MM-DD
  preferredTimeStart: string // HH:MM
  preferredTimeEnd: string // HH:MM
  procedureId?: string
  procedureName?: string
  dentistId?: string
  dentistName?: string
  priority: number // Higher = more urgent
  status: 'waiting' | 'notified' | 'scheduled' | 'expired' | 'cancelled'
  notes?: string
  createdAt: Date
  notifiedAt?: Date
  scheduledAppointmentId?: string
}

export interface CreateWaitlistParams {
  clinicId: string
  patientId: string
  preferredDate: string
  preferredTimeStart: string
  preferredTimeEnd?: string
  procedureId?: string
  dentistId?: string
  priority?: number
  notes?: string
}

/**
 * Add patient to waitlist
 */
export async function addToWaitlist(
  params: CreateWaitlistParams
): Promise<{ success: boolean; entry?: WaitlistEntry; error?: string }> {
  const supabase = await createTypedClient()

  try {
    // Get patient info
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name, phone')
      .eq('id', params.patientId)
      .single() as any

    if (patientError || !patient) {
      return { success: false, error: 'Patient not found' }
    }

    // Check if patient already has a waitlist entry for this date
    const { data: existing } = await (supabase.from('waitlist') as any)
      .select('id')
      .eq('clinic_id', params.clinicId)
      .eq('patient_id', params.patientId)
      .eq('preferred_date', params.preferredDate)
      .eq('status', 'waiting')
      .single()

    if (existing) {
      return { success: false, error: 'Patient already on waitlist for this date' }
    }

    // Get procedure name if provided
    let procedureName: string | undefined
    if (params.procedureId) {
      const { data: procedure } = await supabase
        .from('procedures')
        .select('name')
        .eq('id', params.procedureId)
        .single() as any
      procedureName = procedure?.name
    }

    // Get dentist name if provided
    let dentistName: string | undefined
    if (params.dentistId) {
      const { data: dentist } = await supabase
        .from('dentists')
        .select('name')
        .eq('id', params.dentistId)
        .single() as any
      dentistName = dentist?.name
    }

    // Create waitlist entry
    const { data: entry, error } = await (supabase
      .from('waitlist') as any)
      .insert({
        clinic_id: params.clinicId,
        patient_id: params.patientId,
        preferred_date: params.preferredDate,
        preferred_time_start: params.preferredTimeStart,
        preferred_time_end: params.preferredTimeEnd || params.preferredTimeStart,
        procedure_id: params.procedureId,
        dentist_id: params.dentistId,
        priority: params.priority || 5,
        notes: params.notes,
        status: 'waiting',
      })
      .select()
      .single()

    if (error) {
      dbLogger.error('Error creating waitlist entry', error)
      return { success: false, error: 'Failed to add to waitlist' }
    }

    dbLogger.info(`Patient ${patient.name} added to waitlist`, {
      patientId: params.patientId,
      date: params.preferredDate,
    })

    return {
      success: true,
      entry: {
        id: entry.id,
        clinicId: entry.clinic_id,
        patientId: entry.patient_id,
        patientName: patient.name,
        patientPhone: patient.phone,
        preferredDate: entry.preferred_date,
        preferredTimeStart: entry.preferred_time_start,
        preferredTimeEnd: entry.preferred_time_end,
        procedureId: entry.procedure_id,
        procedureName,
        dentistId: entry.dentist_id,
        dentistName,
        priority: entry.priority,
        status: entry.status,
        notes: entry.notes,
        createdAt: new Date(entry.created_at),
      },
    }
  } catch (error) {
    dbLogger.error('Error in addToWaitlist', error)
    return { success: false, error: 'Internal error' }
  }
}

/**
 * Get waitlist for a clinic
 */
export async function getWaitlist(
  clinicId: string,
  filters?: {
    date?: string
    status?: string
    patientId?: string
  }
): Promise<WaitlistEntry[]> {
  const supabase = await createTypedClient()

  let query = supabase
    .from('waitlist')
    .select(`
      id,
      clinic_id,
      patient_id,
      preferred_date,
      preferred_time_start,
      preferred_time_end,
      procedure_id,
      dentist_id,
      priority,
      status,
      notes,
      created_at,
      notified_at,
      scheduled_appointment_id,
      patients (id, name, phone),
      procedures (name),
      dentists (name)
    `)
    .eq('clinic_id', clinicId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  if (filters?.date) {
    query = query.eq('preferred_date', filters.date)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.patientId) {
    query = query.eq('patient_id', filters.patientId)
  }

  const { data, error } = await query

  if (error) {
    dbLogger.error('Error fetching waitlist', error)
    return []
  }

  return (data || []).map((entry: any) => ({
    id: entry.id,
    clinicId: entry.clinic_id,
    patientId: entry.patient_id,
    patientName: entry.patients?.name || '',
    patientPhone: entry.patients?.phone || '',
    preferredDate: entry.preferred_date,
    preferredTimeStart: entry.preferred_time_start,
    preferredTimeEnd: entry.preferred_time_end,
    procedureId: entry.procedure_id,
    procedureName: entry.procedures?.name,
    dentistId: entry.dentist_id,
    dentistName: entry.dentists?.name,
    priority: entry.priority,
    status: entry.status,
    notes: entry.notes,
    createdAt: new Date(entry.created_at),
    notifiedAt: entry.notified_at ? new Date(entry.notified_at) : undefined,
    scheduledAppointmentId: entry.scheduled_appointment_id,
  }))
}

/**
 * Find matching waitlist entries for an available slot
 */
export async function findMatchingWaitlist(
  clinicId: string,
  date: string,
  time: string,
  dentistId?: string
): Promise<WaitlistEntry[]> {
  const supabase = await createTypedClient()

  // Find entries that match this slot
  const { data, error } = await supabase
    .from('waitlist')
    .select(`
      id,
      clinic_id,
      patient_id,
      preferred_date,
      preferred_time_start,
      preferred_time_end,
      procedure_id,
      dentist_id,
      priority,
      status,
      notes,
      created_at,
      patients (id, name, phone),
      procedures (name),
      dentists (name)
    `)
    .eq('clinic_id', clinicId)
    .eq('preferred_date', date)
    .eq('status', 'waiting')
    .lte('preferred_time_start', time)
    .gte('preferred_time_end', time)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    dbLogger.error('Error finding matching waitlist', error)
    return []
  }

  // Filter by dentist if specified
  let entries = data || []
  if (dentistId) {
    // First, entries that specifically requested this dentist
    const specificDentist = entries.filter((e: any) => e.dentist_id === dentistId)
    // Then, entries without dentist preference
    const noPreference = entries.filter((e: any) => !e.dentist_id)
    entries = [...specificDentist, ...noPreference]
  }

  return entries.map((entry: any) => ({
    id: entry.id,
    clinicId: entry.clinic_id,
    patientId: entry.patient_id,
    patientName: entry.patients?.name || '',
    patientPhone: entry.patients?.phone || '',
    preferredDate: entry.preferred_date,
    preferredTimeStart: entry.preferred_time_start,
    preferredTimeEnd: entry.preferred_time_end,
    procedureId: entry.procedure_id,
    procedureName: entry.procedures?.name,
    dentistId: entry.dentist_id,
    dentistName: entry.dentists?.name,
    priority: entry.priority,
    status: entry.status,
    notes: entry.notes,
    createdAt: new Date(entry.created_at),
  }))
}

/**
 * Notify patient about available slot
 */
export async function notifyWaitlistPatient(
  entry: WaitlistEntry,
  availableSlot: { date: string; time: string; dentistName?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createTypedClient()

  try {
    const dateStr = new Date(availableSlot.date).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    })

    const message = `🏥 *Vaga Disponível!*

Olá, ${entry.patientName}!

Temos uma vaga disponível:
📅 ${dateStr}
⏰ às ${availableSlot.time}
${availableSlot.dentistName ? `👨‍⚕️ Dr(a). ${availableSlot.dentistName}` : ''}
${entry.procedureName ? `🦷 ${entry.procedureName}` : ''}

Quer garantir este horário? Responda "SIM" para confirmar ou "NÃO" para continuar na lista de espera.

⚠️ Esta vaga é válida por 2 horas.`

    // Send WhatsApp message
    const whatsappApiUrl = process.env.WHATSAPP_API_URL
    const whatsappToken = process.env.WHATSAPP_TOKEN

    if (!whatsappApiUrl || !whatsappToken) {
      return { success: false, error: 'WhatsApp not configured' }
    }

    let formattedPhone = entry.patientPhone.replace(/\D/g, '')
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone
    }

    const response = await fetch(whatsappApiUrl, {
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

    if (!response.ok) {
      const data = await response.json()
      whatsappLogger.error('Failed to send waitlist notification', null, { data })
      return { success: false, error: 'Failed to send notification' }
    }

    // Update waitlist entry status
    await (supabase.from('waitlist') as any)
      .update({
        status: 'notified',
        notified_at: new Date().toISOString(),
      })
      .eq('id', entry.id)

    dbLogger.info(`Notified patient ${entry.patientName} about available slot`)

    return { success: true }
  } catch (error) {
    dbLogger.error('Error notifying waitlist patient', error)
    return { success: false, error: 'Internal error' }
  }
}

/**
 * Mark waitlist entry as scheduled
 */
export async function markWaitlistScheduled(
  waitlistId: string,
  appointmentId: string
): Promise<void> {
  const supabase = await createTypedClient()

  await (supabase.from('waitlist') as any)
    .update({
      status: 'scheduled',
      scheduled_appointment_id: appointmentId,
    })
    .eq('id', waitlistId)

  dbLogger.info(`Waitlist entry ${waitlistId} marked as scheduled`)
}

/**
 * Cancel waitlist entry
 */
export async function cancelWaitlistEntry(
  waitlistId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createTypedClient()

  const { error } = await (supabase
    .from('waitlist') as any)
    .update({
      status: 'cancelled',
      notes: reason,
    })
    .eq('id', waitlistId)

  if (error) {
    dbLogger.error('Error cancelling waitlist entry', error)
    return { success: false, error: 'Failed to cancel' }
  }

  return { success: true }
}

/**
 * Expire old waitlist entries (called by cron)
 */
export async function expireOldWaitlistEntries(): Promise<{ expired: number }> {
  const supabase = await createTypedClient()

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const { data, error } = await (supabase
    .from('waitlist') as any)
    .update({ status: 'expired' })
    .eq('status', 'waiting')
    .lt('preferred_date', yesterday.toISOString().split('T')[0])
    .select('id')

  if (error) {
    dbLogger.error('Error expiring waitlist entries', error)
    return { expired: 0 }
  }

  const expired = data?.length || 0
  if (expired > 0) {
    dbLogger.info(`Expired ${expired} old waitlist entries`)
  }

  return { expired }
}

/**
 * Process waitlist when appointment is cancelled
 */
export async function processWaitlistOnCancellation(
  clinicId: string,
  date: string,
  time: string,
  dentistId?: string
): Promise<{ notified: number }> {
  const matchingEntries = await findMatchingWaitlist(clinicId, date, time, dentistId)

  let notified = 0

  // Notify first matching patient
  if (matchingEntries.length > 0) {
    const entry = matchingEntries[0]
    const result = await notifyWaitlistPatient(entry, {
      date,
      time,
      dentistName: entry.dentistName,
    })

    if (result.success) {
      notified = 1
    }
  }

  return { notified }
}