/**
 * Lead Notification Service
 * Handles hot lead notifications via WhatsApp with deduplication
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger, createLogger } from '@/lib/logger'
import { sendWhatsAppMessage } from '@/services/whatsapp'
import { getHotLeads, type Lead } from './leads.service'

const logger = createLogger('lead-notifications')

const HOT_LEAD_THRESHOLD = 70
const DEDUP_HOURS = 24

export interface LeadNotification {
  id: string
  lead_id: string
  clinic_id: string
  type: 'hot_lead' | 'lead_converted' | 'lead_cold'
  channel: 'whatsapp' | 'in_app'
  sent_at: string
  acknowledged: boolean
  lead_name?: string
  lead_phone?: string
  lead_score?: number
  lead_source?: string
  lead_interest?: string
}

interface NotificationRow {
  id: string
  lead_id: string
  clinic_id: string
  type: string
  channel: string
  sent_at: string
  acknowledged: boolean
  lead_name?: string
  lead_phone?: string
  lead_score?: number
  lead_source?: string
  lead_interest?: string
}

function toNotification(row: NotificationRow): LeadNotification {
  return {
    id: row.id,
    lead_id: row.lead_id,
    clinic_id: row.clinic_id,
    type: row.type as LeadNotification['type'],
    channel: row.channel as LeadNotification['channel'],
    sent_at: row.sent_at,
    acknowledged: row.acknowledged,
    lead_name: row.lead_name,
    lead_phone: row.lead_phone,
    lead_score: row.lead_score,
    lead_source: row.lead_source,
    lead_interest: row.lead_interest,
  }
}

/**
 * Check if a lead was already notified within the dedup window
 */
async function wasRecentlyNotified(leadId: string): Promise<boolean> {
  const supabase = await createTypedClient()
  const cutoff = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('lead_notifications')
    .select('id')
    .eq('lead_id', leadId)
    .eq('type', 'hot_lead')
    .gte('sent_at', cutoff)
    .limit(1)

  if (error) {
    logger.warn('Failed to check dedup', { leadId, error: error.message })
    return false
  }

  return (data?.length ?? 0) > 0
}

/**
 * Find the responsible person's phone for a lead
 */
async function getResponsiblePhone(
  clinicId: string,
  assignedTo?: string | null
): Promise<string | null> {
  const supabase = await createTypedClient()

  // If lead is assigned to someone, use their phone
  if (assignedTo) {
    const { data: user } = await supabase
      .from('users')
      .select('phone')
      .eq('id', assignedTo)
      .single() as any

    if ((user as any)?.phone) return (user as any).phone
  }

  // Fallback to clinic owner/admin
  const { data: admin } = await supabase
    .from('users')
    .select('phone')
    .eq('clinic_id', clinicId)
    .in('role', ['owner', 'admin'])
    .eq('is_active', true)
    .limit(1)
    .single() as any

  return admin?.phone ?? null
}

/**
 * Build the WhatsApp notification message for a hot lead
 */
function buildHotLeadMessage(lead: Lead): string {
  const interest = lead.interest ? `\n- Interesse: ${lead.interest}` : ''
  const notes = lead.notes ? `\n- Observacoes: ${lead.notes}` : ''

  return (
    `LEAD QUENTE DETECTADO!\n\n` +
    `Nome: ${lead.name}\n` +
    `Telefone: ${lead.phone}\n` +
    `Email: ${lead.email || 'N/A'}\n` +
    `Origem: ${lead.source}\n` +
    `Score: ${lead.score}/100\n` +
    `Status: ${lead.status}${interest}${notes}\n\n` +
    `Acesse o painel para agir rapidamente!`
  )
}

/**
 * Store a notification record in the database
 */
async function storeNotification(params: {
  leadId: string
  clinicId: string
  type: LeadNotification['type']
  channel: LeadNotification['channel']
  lead: Lead
}): Promise<LeadNotification | null> {
  const supabase = await createTypedClient()

  const { data, error } = await (supabase
    .from('lead_notifications') as any)
    .insert({
      lead_id: params.leadId,
      clinic_id: params.clinicId,
      type: params.type,
      channel: params.channel,
      sent_at: new Date().toISOString(),
      acknowledged: false,
      lead_name: params.lead.name,
      lead_phone: params.lead.phone,
      lead_score: params.lead.score,
      lead_source: params.lead.source,
      lead_interest: params.lead.interest,
    })
    .select()
    .single()

  if (error) {
    logger.error('Failed to store notification', error, { leadId: params.leadId })
    return null
  }

  return toNotification(data as NotificationRow)
}

/**
 * Notify a single hot lead
 * Checks dedup, sends WhatsApp, stores record
 */
export async function notifyHotLead(leadId: string): Promise<{ sent: boolean; error?: string }> {
  const supabase = await createTypedClient()

  try {
    // Fetch lead
    const { data: lead, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (fetchError || !lead) {
      return { sent: false, error: 'Lead not found' }
    }

    const typedLead = lead as Lead

    // Only notify if score meets threshold
    if (typedLead.score < HOT_LEAD_THRESHOLD) {
      return { sent: false, error: `Score ${typedLead.score} below threshold ${HOT_LEAD_THRESHOLD}` }
    }

    // Dedup check
    if (await wasRecentlyNotified(leadId)) {
      logger.info('Skipping duplicate notification', { leadId })
      return { sent: false, error: 'Already notified within 24h' }
    }

    // Find responsible person
    const phone = await getResponsiblePhone(typedLead.clinic_id, typedLead.assigned_to)
    if (!phone) {
      logger.warn('No responsible phone found for clinic', { clinicId: typedLead.clinic_id })
      // Store as in_app notification even without WhatsApp
      await storeNotification({
        leadId,
        clinicId: typedLead.clinic_id,
        type: 'hot_lead',
        channel: 'in_app',
        lead: typedLead,
      })
      return { sent: false, error: 'No phone number found for notification' }
    }

    // Send WhatsApp message
    const message = buildHotLeadMessage(typedLead)
    const result = await sendWhatsAppMessage(phone, message)

    if (!result.success) {
      logger.error('WhatsApp send failed', new Error(result.error || 'Unknown'), { leadId, phone })
      // Still store the notification for in-app display
      await storeNotification({
        leadId,
        clinicId: typedLead.clinic_id,
        type: 'hot_lead',
        channel: 'in_app',
        lead: typedLead,
      })
      return { sent: false, error: result.error || 'WhatsApp send failed' }
    }

    // Store successful notification
    const notification = await storeNotification({
      leadId,
      clinicId: typedLead.clinic_id,
      type: 'hot_lead',
      channel: 'whatsapp',
      lead: typedLead,
    })

    logger.info('Hot lead notification sent', {
      leadId,
      notificationId: notification?.id,
      channel: 'whatsapp',
    })

    return { sent: true }
  } catch (error) {
    logger.error('Error notifying hot lead', error, { leadId })
    return { sent: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Scan all leads for a clinic and notify those that crossed the hot threshold
 * Used by the daily cron job
 */
export async function checkAndNotifyHotLeads(clinicId: string): Promise<void> {
  try {
    const hotLeads = await getHotLeads(clinicId, 50)

    logger.info('Checking hot leads for clinic', {
      clinicId,
      hotLeadsCount: hotLeads.length,
    })

    for (const lead of hotLeads) {
      if (lead.score >= HOT_LEAD_THRESHOLD) {
        await notifyHotLead(lead.id)
      }
    }
  } catch (error) {
    logger.error('Error in checkAndNotifyHotLeads', error, { clinicId })
  }
}

/**
 * Get unacknowledged notifications for a clinic
 */
export async function getUnacknowledgedNotifications(
  clinicId: string
): Promise<LeadNotification[]> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await supabase
      .from('lead_notifications')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('acknowledged', false)
      .order('sent_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return (data || []).map((row) => toNotification(row as NotificationRow))
  } catch (error) {
    logger.error('Error fetching unacknowledged notifications', error, { clinicId })
    return []
  }
}

/**
 * Scan all active clinics and notify hot leads
 * Used by the cron job to process all clinics at once
 */
export async function checkAllClinicsHotLeads(): Promise<void> {
  const supabase = await createTypedClient()

  try {
    const { data: clinics, error } = await supabase
      .from('clinics')
      .select('id')
      .limit(100) as any

    if (error) throw error

    logger.info('Scanning hot leads across clinics', {
      clinicCount: (clinics as any[])?.length ?? 0,
    })

    for (const clinic of (clinics as any[]) || []) {
      await checkAndNotifyHotLeads(clinic.id)
    }
  } catch (error) {
    logger.error('Error in checkAllClinicsHotLeads', error)
  }
}

/**
 * Mark a notification as acknowledged
 */
export async function acknowledgeNotification(notificationId: string): Promise<boolean> {
  const supabase = await createTypedClient()

  try {
    const { error } = await (supabase
      .from('lead_notifications') as any)
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', notificationId)

    if (error) throw error

    logger.info('Notification acknowledged', { notificationId })
    return true
  } catch (error) {
    logger.error('Error acknowledging notification', error, { notificationId })
    return false
  }
}
