/**
 * Timeline Service — migrated to Drizzle
 * Aggregates events from appointments, messages, lead_activities, and patient_observations
 */

import { eq, and, inArray, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { appointments, conversations, messages, patientObservations, leadActivities, leads } from '@/lib/db/schema'
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
    const [ts, id] = Buffer.from(cursor, 'base64url').toString().split('::')
    return ts && id ? { timestamp: ts, id } : null
  } catch {
    return null
  }
}

interface TimelineOptions {
  cursor?: string
  limit?: number
  typeFilter?: TimelineSourceType
}

// ─── Schema gaps ───
// appointments.title: not in Drizzle schema → fallback to 'Appointment'
// conversations.leadId: not in Drizzle schema → as any cast

export async function getContactTimeline(
  clinicId: string,
  contactId: string,
  contactType: 'patient' | 'lead',
  options: TimelineOptions = {},
): Promise<TimelinePage> {
  const db = getDb()
  const { cursor, limit = 20, typeFilter } = options

  try {
    const allEvents: TimelineEvent[] = []

    if (contactType === 'patient') {
      // ── Appointments ──
      const aptRows = await db
        .select({
          id: appointments.id,
          status: appointments.status,
          scheduledAt: appointments.scheduledAt,
          dentistId: appointments.dentistId,
          createdAt: appointments.createdAt,
        })
        .from(appointments)
        .where(and(eq(appointments.patientId, contactId), eq(appointments.clinicId, clinicId)))

      for (const a of aptRows) {
        allEvents.push({
          id: a.id,
          source: 'appointment',
          event_type: a.status || 'created',
          description: 'Appointment',
          event_timestamp: (a.scheduledAt ?? a.createdAt)?.toISOString?.() ?? '',
          contact_id: contactId,
          contact_type: 'patient',
          metadata: { dentist_id: a.dentistId, status: a.status },
        })
      }

      // ── Messages via conversations ──
      const convRows = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.patientId, contactId), eq(conversations.clinicId, clinicId)))

      if (convRows.length) {
        const convIds = convRows.map((c) => c.id)
        const msgRows = await db
          .select({
            id: messages.id,
            conversationId: messages.conversationId,
            content: messages.content,
            direction: messages.direction,
            messageType: messages.messageType,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(inArray(messages.conversationId, convIds))
          .orderBy(desc(messages.createdAt))
          .limit(100)

        for (const m of msgRows) {
          allEvents.push({
            id: m.id,
            source: 'message',
            event_type: m.direction === 'inbound' ? 'received' : 'sent',
            description: m.content || '',
            event_timestamp: m.createdAt?.toISOString?.() ?? '',
            contact_id: contactId,
            contact_type: 'patient',
            metadata: { message_type: m.messageType, conversation_id: m.conversationId },
          })
        }
      }

      // ── Patient observations ──
      const obsRows = await db
        .select({
          id: patientObservations.id,
          content: patientObservations.content,
          createdBy: patientObservations.createdBy,
          createdAt: patientObservations.createdAt,
        })
        .from(patientObservations)
        .where(and(eq(patientObservations.patientId, contactId), eq(patientObservations.clinicId, clinicId)))

      for (const o of obsRows) {
        allEvents.push({
          id: o.id,
          source: 'note',
          event_type: 'note',
          description: o.content || '',
          event_timestamp: o.createdAt?.toISOString?.() ?? '',
          contact_id: contactId,
          contact_type: 'patient',
          metadata: { created_by: o.createdBy },
        })
      }
    } else {
      // ── Lead activities ──
      const actRows = await db
        .select({
          id: leadActivities.id,
          activityType: leadActivities.activityType,
          description: leadActivities.description,
          performedAt: leadActivities.performedAt,
          metadata: leadActivities.metadata,
          createdAt: leadActivities.createdAt,
        })
        .from(leadActivities)
        .where(eq(leadActivities.leadId, contactId))

      for (const a of actRows) {
        allEvents.push({
          id: a.id,
          source: 'lead_activity',
          event_type: a.activityType || 'note',
          description: a.description || '',
          event_timestamp: (a.performedAt ?? a.createdAt)?.toISOString?.() ?? '',
          contact_id: contactId,
          contact_type: 'lead',
          metadata: (a.metadata as Record<string, unknown>) || {},
        })
      }

      // ── Messages via conversations (leadId — schema gap) ──
      const convRows = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq((conversations as any).leadId, contactId), eq(conversations.clinicId, clinicId)))

      if (convRows.length) {
        const convIds = convRows.map((c) => c.id)
        const msgRows = await db
          .select({
            id: messages.id,
            conversationId: messages.conversationId,
            content: messages.content,
            direction: messages.direction,
            messageType: messages.messageType,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(inArray(messages.conversationId, convIds))
          .orderBy(desc(messages.createdAt))
          .limit(100)

        for (const m of msgRows) {
          allEvents.push({
            id: m.id,
            source: 'message',
            event_type: m.direction === 'inbound' ? 'received' : 'sent',
            description: m.content || '',
            event_timestamp: m.createdAt?.toISOString?.() ?? '',
            contact_id: contactId,
            contact_type: 'lead',
            metadata: { message_type: m.messageType, conversation_id: m.conversationId },
          })
        }
      }

      // ── Linked patient: appointments + observations ──
      const [leadRow] = await db
        .select({ patientId: leads.patientId })
        .from(leads)
        .where(eq(leads.id, contactId))

      if (leadRow?.patientId) {
        const pid = leadRow.patientId

        const aptRows = await db
          .select({
            id: appointments.id,
            status: appointments.status,
            scheduledAt: appointments.scheduledAt,
            dentistId: appointments.dentistId,
            createdAt: appointments.createdAt,
          })
          .from(appointments)
          .where(and(eq(appointments.patientId, pid), eq(appointments.clinicId, clinicId)))

        for (const a of aptRows) {
          allEvents.push({
            id: a.id,
            source: 'appointment',
            event_type: a.status || 'created',
            description: 'Appointment',
            event_timestamp: (a.scheduledAt ?? a.createdAt)?.toISOString?.() ?? '',
            contact_id: contactId,
            contact_type: 'lead',
            metadata: { dentist_id: a.dentistId, status: a.status, patient_id: pid },
          })
        }

        const obsRows = await db
          .select({
            id: patientObservations.id,
            content: patientObservations.content,
            createdBy: patientObservations.createdBy,
            createdAt: patientObservations.createdAt,
          })
          .from(patientObservations)
          .where(and(eq(patientObservations.patientId, pid), eq(patientObservations.clinicId, clinicId)))

        for (const o of obsRows) {
          allEvents.push({
            id: o.id,
            source: 'note',
            event_type: 'note',
            description: o.content || '',
            event_timestamp: o.createdAt?.toISOString?.() ?? '',
            contact_id: contactId,
            contact_type: 'lead',
            metadata: { created_by: o.createdBy, patient_id: pid },
          })
        }
      }
    }

    // ── Filter, sort, paginate (pure JS) ──
    const filtered = typeFilter
      ? allEvents.filter((e) => e.source === typeFilter)
      : allEvents

    filtered.sort((a, b) => {
      const diff = new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime()
      return diff !== 0 ? diff : b.id.localeCompare(a.id)
    })

    let startIndex = 0
    if (cursor) {
      const dec = decodeCursor(cursor)
      if (dec) {
        const cursorTime = new Date(dec.timestamp).getTime()
        startIndex = filtered.findIndex(
          (e) =>
            new Date(e.event_timestamp).getTime() < cursorTime ||
            (new Date(e.event_timestamp).getTime() === cursorTime &&
              e.id.localeCompare(dec.id) < 0),
        )
        if (startIndex === -1) startIndex = filtered.length
      }
    }

    const pageEvents = filtered.slice(startIndex, startIndex + limit)
    const hasMore = startIndex + limit < filtered.length

    const next_cursor =
      hasMore && pageEvents.length > 0
        ? encodeCursor(
            pageEvents[pageEvents.length - 1].event_timestamp,
            pageEvents[pageEvents.length - 1].id,
          )
        : null

    return { events: pageEvents, next_cursor }
  } catch (error) {
    dbLogger.error('Error getting contact timeline', error)
    throw error
  }
}
