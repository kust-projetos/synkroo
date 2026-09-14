import { NextRequest } from 'next/server'
import { eq, and, isNotNull, inArray } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { getDb } from '@/lib/db/client'
import { leads, patients, leadActivities, messages, conversations, appointments, patientObservations } from '@/lib/db/schema'
import type { TimelineSourceType } from '@/services/contacts/timeline.service'

interface AllActivitiesResponse {
  events: ActivityEvent[]
  next_cursor: string | null
}

interface ActivityEvent {
  id: string
  source: TimelineSourceType
  event_type: string
  description: string
  event_timestamp: string
  contact_id: string
  contact_type: 'patient' | 'lead'
  contact_name?: string
  metadata: Record<string, unknown>
}

function encodeCursor(timestamp: string, id: string): string {
  return Buffer.from(`${timestamp}::${id}`).toString('base64url')
}

function decodeCursor(cursor: string): { timestamp: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8')
    const [timestamp, id] = decoded.split('::')
    return { timestamp, id }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const auth = await validateApiAuth()
  if (!auth.success) {
    return apiAuthFailure(auth.error, requestId)
  }

  const clinicId = auth.profile!.clinic_id
  const { searchParams } = new URL(request.url)

  const cursor = searchParams.get('cursor') || undefined
  const limit = parseInt(searchParams.get('limit') || '20')
  const source = searchParams.get('source') as TimelineSourceType | null
  const contactFilter = searchParams.get('contact_id') || undefined
  const startDate = searchParams.get('start_date') || undefined
  const endDate = searchParams.get('end_date') || undefined

  try {
    const db = getDb()

    const allEvents: ActivityEvent[] = []

    // Fetch all leads for the clinic to get contact names
    const leadRows = await db
      .select({ id: leads.id, name: leads.name })
      .from(leads)
      .where(eq(leads.clinicId, clinicId))

    const leadNames: Record<string, string> = {}
    for (const lead of leadRows) {
      leadNames[lead.id] = lead.name
    }

    // Fetch all patients for the clinic to get contact names
    const patientRows = await db
      .select({ id: patients.id, name: patients.name })
      .from(patients)
      .where(eq(patients.clinicId, clinicId))

    const patientNames: Record<string, string> = {}
    for (const patient of patientRows) {
      patientNames[patient.id] = patient.name
    }

    // Source 1: Lead activities (via leads -> clinicId)
    const clinicLeads = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.clinicId, clinicId))
    const leadIds = clinicLeads.map(l => l.id)

    const leadActivityRows = leadIds.length > 0
      ? await db
          .select({
            id: leadActivities.id,
            leadId: leadActivities.leadId,
            activityType: leadActivities.activityType,
            description: leadActivities.description,
            performedAt: leadActivities.performedAt,
            metadata: leadActivities.metadata,
            createdAt: leadActivities.createdAt,
          })
          .from(leadActivities)
          .where(inArray(leadActivities.leadId, leadIds))
      : []

    for (const act of leadActivityRows) {
      const ts = act.performedAt || act.createdAt || new Date()
      allEvents.push({
        id: act.id,
        source: 'lead_activity',
        event_type: act.activityType || 'note',
        description: act.description || '',
        event_timestamp: ts instanceof Date ? ts.toISOString() : String(ts),
        contact_id: act.leadId,
        contact_type: 'lead',
        contact_name: leadNames[act.leadId] || 'Lead',
        metadata: (act.metadata as Record<string, unknown>) || {},
      })
    }

    // Source 2: Messages via conversations
    const clinicConversations = await db
      .select({ id: conversations.id, patientId: conversations.patientId })
      .from(conversations)
      .where(eq(conversations.clinicId, clinicId))
    const convIds = clinicConversations.map(c => c.id)
    const convPatientMap = new Map(clinicConversations.map(c => [c.id, c.patientId]))

    const messageRows = convIds.length > 0
      ? await db
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
      : []

    for (const msg of messageRows) {
      const patientId = convPatientMap.get(msg.conversationId)
      const contactName = patientId ? patientNames[patientId] || 'Paciente' : 'Unknown'
      const ts = msg.createdAt || new Date()

      allEvents.push({
        id: msg.id,
        source: 'message',
        event_type: msg.direction === 'inbound' ? 'received' : 'sent',
        description: msg.content || '',
        event_timestamp: ts instanceof Date ? ts.toISOString() : String(ts),
        contact_id: patientId || '',
        contact_type: 'patient',
        contact_name: contactName,
        metadata: { message_type: msg.messageType, conversation_id: msg.conversationId },
      })
    }

    // Source 3: Appointments (patients)
    const appointmentRows = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        status: appointments.status,
        scheduledAt: appointments.scheduledAt,
        dentistId: appointments.dentistId,
        notes: appointments.notes,
        createdAt: appointments.createdAt,
      })
      .from(appointments)
      .where(and(
        eq(appointments.clinicId, clinicId),
        isNotNull(appointments.patientId)
      ))

    for (const apt of appointmentRows) {
      const ts = apt.scheduledAt || apt.createdAt || new Date()
      allEvents.push({
        id: apt.id,
        source: 'appointment',
        event_type: apt.status || 'created',
        description: apt.notes || 'Appointment',
        event_timestamp: ts instanceof Date ? ts.toISOString() : String(ts),
        contact_id: apt.patientId,
        contact_type: 'patient',
        contact_name: patientNames[apt.patientId] || 'Paciente',
        metadata: { dentist_id: apt.dentistId, status: apt.status },
      })
    }

    // Source 4: Patient observations (notes)
    const observationRows = await db
      .select({
        id: patientObservations.id,
        patientId: patientObservations.patientId,
        content: patientObservations.content,
        createdBy: patientObservations.createdBy,
        createdAt: patientObservations.createdAt,
      })
      .from(patientObservations)
      .where(eq(patientObservations.clinicId, clinicId))

    for (const obs of observationRows) {
      const ts = obs.createdAt || new Date()
      allEvents.push({
        id: obs.id,
        source: 'note',
        event_type: 'note',
        description: obs.content || '',
        event_timestamp: ts instanceof Date ? ts.toISOString() : String(ts),
        contact_id: obs.patientId,
        contact_type: 'patient',
        contact_name: patientNames[obs.patientId] || 'Paciente',
        metadata: { created_by: obs.createdBy },
      })
    }

    // Apply source filter if provided
    let filtered = allEvents
    if (source) {
      filtered = allEvents.filter(e => e.source === source)
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

    const response: AllActivitiesResponse = {
      events: pageEvents,
      next_cursor,
    }

    return apiSuccess(response)
  } catch (error) {
    console.error('Error fetching all activities:', error)
    return apiFailure('INTERNAL_ERROR', 'Failed to fetch activities', requestId, 500)
  }
}