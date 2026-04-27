/**
 * Timeline Service
 * Aggregates events from appointments, messages, lead_activities, and patient_observations
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export type TimelineSourceType = 'appointment' | 'message' | 'lead_activity' | 'note'
export type TimelineEventType =
  | 'created' | 'confirmed' | 'cancelled' | 'no_show'
  | 'sent' | 'received'
  | 'call' | 'email' | 'meeting' | 'status_change' | 'qualification' | 'note'

export interface TimelineEvent {
  id: string
  source: TimelineSourceType
  event_type: string
  description: string
  event_timestamp: string
  contact_id: string
  contact_type: 'patient' | 'lead'
  metadata: Record<string, unknown>
}

export interface TimelinePage {
  events: TimelineEvent[]
  next_cursor: string | null
}

function encodeCursor(timestamp: string, id: string): string {
  return Buffer.from(`${timestamp}::${id}`).toString('base64url')
}

function decodeCursor(cursor: string): { timestamp: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString()
    const [timestamp, id] = decoded.split('::')
    if (!timestamp || !id) return null
    return { timestamp, id }
  } catch {
    return null
  }
}

interface TimelineOptions {
  cursor?: string
  limit?: number
  typeFilter?: TimelineSourceType
}

export async function getContactTimeline(
  clinicId: string,
  contactId: string,
  contactType: 'patient' | 'lead',
  options: TimelineOptions = {}
): Promise<TimelinePage> {
  const supabase = await createTypedClient()
  const { cursor, limit = 20, typeFilter } = options

  try {
    const allEvents: TimelineEvent[] = []

    if (contactType === 'patient') {
      // Source 1: Appointments
      const { data: appointments } = await (supabase
        .from('appointments') as any)
        .select('id, patient_id, title, status, scheduled_at, dentist_id, created_at')
        .eq('patient_id', contactId)
        .eq('clinic_id', clinicId)

      if (appointments) {
        for (const apt of appointments as any[]) {
          allEvents.push({
            id: apt.id,
            source: 'appointment',
            event_type: apt.status || 'created',
            description: apt.title || 'Appointment',
            event_timestamp: apt.scheduled_at || apt.created_at,
            contact_id: contactId,
            contact_type: 'patient',
            metadata: { dentist_id: apt.dentist_id, status: apt.status },
          })
        }
      }

      // Source 2: Messages via conversations
      const { data: conversations } = await (supabase
        .from('conversations') as any)
        .select('id, patient_id')
        .eq('patient_id', contactId)
        .eq('clinic_id', clinicId)

      if (conversations && conversations.length > 0) {
        const convIds = (conversations as any[]).map((c: any) => c.id)
        const { data: messages } = await (supabase
          .from('messages') as any)
          .select('id, conversation_id, content, direction, message_type, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(100)

        if (messages) {
          for (const msg of messages as any[]) {
            allEvents.push({
              id: msg.id,
              source: 'message',
              event_type: msg.direction === 'inbound' ? 'received' : 'sent',
              description: msg.content || '',
              event_timestamp: msg.created_at,
              contact_id: contactId,
              contact_type: 'patient',
              metadata: { message_type: msg.message_type, conversation_id: msg.conversation_id },
            })
          }
        }
      }

      // Source 3: Patient observations (NOT patients.notes)
      const { data: observations } = await (supabase
        .from('patient_observations') as any)
        .select('id, patient_id, content, created_by, created_at')
        .eq('patient_id', contactId)
        .eq('clinic_id', clinicId)

      if (observations) {
        for (const obs of observations as any[]) {
          allEvents.push({
            id: obs.id,
            source: 'note',
            event_type: 'note',
            description: obs.content || '',
            event_timestamp: obs.created_at,
            contact_id: contactId,
            contact_type: 'patient',
            metadata: { created_by: obs.created_by },
          })
        }
      }
    } else {
      // Lead contact

      // Source 1: Lead activities
      const { data: activities } = await (supabase
        .from('lead_activities') as any)
        .select('id, lead_id, activity_type, description, performed_at, metadata, created_at')
        .eq('lead_id', contactId)

      if (activities) {
        for (const act of activities as any[]) {
          allEvents.push({
            id: act.id,
            source: 'lead_activity',
            event_type: act.activity_type || 'note',
            description: act.description || '',
            event_timestamp: act.performed_at || act.created_at,
            contact_id: contactId,
            contact_type: 'lead',
            metadata: act.metadata || {},
          })
        }
      }

      // Source 2: Messages via conversations
      const { data: conversations } = await (supabase
        .from('conversations') as any)
        .select('id, lead_id')
        .eq('lead_id', contactId)
        .eq('clinic_id', clinicId)

      if (conversations && conversations.length > 0) {
        const convIds = (conversations as any[]).map((c: any) => c.id)
        const { data: messages } = await (supabase
          .from('messages') as any)
          .select('id, conversation_id, content, direction, message_type, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(100)

        if (messages) {
          for (const msg of messages as any[]) {
            allEvents.push({
              id: msg.id,
              source: 'message',
              event_type: msg.direction === 'inbound' ? 'received' : 'sent',
              description: msg.content || '',
              event_timestamp: msg.created_at,
              contact_id: contactId,
              contact_type: 'lead',
              metadata: { message_type: msg.message_type, conversation_id: msg.conversation_id },
            })
          }
        }
      }

      // Source 3 & 4: If lead has patient_id, get appointments and observations
      const { data: leadData } = await (supabase
        .from('leads') as any)
        .select('patient_id')
        .eq('id', contactId)
        .single()

      if (leadData?.patient_id) {
        const patientId = leadData.patient_id

        const { data: appointments } = await (supabase
          .from('appointments') as any)
          .select('id, patient_id, title, status, scheduled_at, dentist_id, created_at')
          .eq('patient_id', patientId)
          .eq('clinic_id', clinicId)

        if (appointments) {
          for (const apt of appointments as any[]) {
            allEvents.push({
              id: apt.id,
              source: 'appointment',
              event_type: apt.status || 'created',
              description: apt.title || 'Appointment',
              event_timestamp: apt.scheduled_at || apt.created_at,
              contact_id: contactId,
              contact_type: 'lead',
              metadata: { dentist_id: apt.dentist_id, status: apt.status, patient_id: patientId },
            })
          }
        }

        const { data: observations } = await (supabase
          .from('patient_observations') as any)
          .select('id, patient_id, content, created_by, created_at')
          .eq('patient_id', patientId)
          .eq('clinic_id', clinicId)

        if (observations) {
          for (const obs of observations as any[]) {
            allEvents.push({
              id: obs.id,
              source: 'note',
              event_type: 'note',
              description: obs.content || '',
              event_timestamp: obs.created_at,
              contact_id: contactId,
              contact_type: 'lead',
              metadata: { created_by: obs.created_by, patient_id: patientId },
            })
          }
        }
      }
    }

    // Apply type filter if provided
    let filtered = allEvents
    if (typeFilter) {
      filtered = allEvents.filter(e => e.source === typeFilter)
    }

    // Sort by event_timestamp DESC, then by id for stable ordering
    filtered.sort((a, b) => {
      const tsDiff = new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime()
      if (tsDiff !== 0) return tsDiff
      return b.id.localeCompare(a.id)
    })

    // Apply cursor-based pagination
    let startIndex = 0
    if (cursor) {
      const decoded = decodeCursor(cursor)
      if (decoded) {
        const cursorTime = new Date(decoded.timestamp).getTime()
        startIndex = filtered.findIndex(e =>
          new Date(e.event_timestamp).getTime() < cursorTime ||
          (new Date(e.event_timestamp).getTime() === cursorTime && e.id.localeCompare(decoded.id) < 0)
        )
        if (startIndex === -1) startIndex = filtered.length
      }
    }

    const pageEvents = filtered.slice(startIndex, startIndex + limit)
    const hasMore = startIndex + limit < filtered.length

    const next_cursor = hasMore && pageEvents.length > 0
      ? encodeCursor(pageEvents[pageEvents.length - 1].event_timestamp, pageEvents[pageEvents.length - 1].id)
      : null

    return {
      events: pageEvents,
      next_cursor,
    }
  } catch (error) {
    dbLogger.error('Error getting contact timeline', error)
    throw error
  }
}