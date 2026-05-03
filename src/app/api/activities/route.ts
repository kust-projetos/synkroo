import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
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
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
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
    const supabase = createTypedClient()

    const allEvents: ActivityEvent[] = []

    // Fetch all leads for the clinic to get contact names
    const { data: leads } = await (supabase
      .from('leads') as any)
      .select('id, name')
      .eq('clinic_id', clinicId)

    const leadNames: Record<string, string> = {}
    if (leads) {
      for (const lead of leads as any[]) {
        leadNames[lead.id] = lead.name
      }
    }

    // Fetch all patients for the clinic to get contact names
    const { data: patients } = await (supabase
      .from('patients') as any)
      .select('id, name')
      .eq('clinic_id', clinicId)

    const patientNames: Record<string, string> = {}
    if (patients) {
      for (const patient of patients as any[]) {
        patientNames[patient.id] = patient.name
      }
    }

    // Source 1: Lead activities
    let leadActivitiesQuery = (supabase
      .from('lead_activities') as any)
      .select('id, lead_id, activity_type, description, performed_at, metadata, created_at')
      .eq('clinic_id', clinicId)

    if (contactFilter) {
      leadActivitiesQuery = leadActivitiesQuery.eq('lead_id', contactFilter)
    }
    if (startDate) {
      leadActivitiesQuery = leadActivitiesQuery.gte('performed_at', startDate)
    }
    if (endDate) {
      leadActivitiesQuery = leadActivitiesQuery.lte('performed_at', endDate)
    }

    const { data: activities } = await leadActivitiesQuery

    if (activities) {
      for (const act of activities as any[]) {
        allEvents.push({
          id: act.id,
          source: 'lead_activity',
          event_type: act.activity_type || 'note',
          description: act.description || '',
          event_timestamp: act.performed_at || act.created_at,
          contact_id: act.lead_id,
          contact_type: 'lead',
          contact_name: leadNames[act.lead_id] || 'Lead',
          metadata: act.metadata || {},
        })
      }
    }

    // Source 2: Messages via conversations (all leads and patients)
    let messagesQuery = (supabase
      .from('messages') as any)
      .select(`
        id,
        conversation_id,
        content,
        direction,
        message_type,
        created_at,
        conversations!inner(lead_id, patient_id, clinic_id)
      `)
      .eq('conversations.clinic_id', clinicId)

    if (contactFilter) {
      // Filter by lead_id or patient_id in conversations
      const { data: convData } = await (supabase
        .from('conversations') as any)
        .select('id')
        .eq('clinic_id', clinicId)
        .or(`lead_id.eq.${contactFilter},patient_id.eq.${contactFilter}`)

      if (convData && convData.length > 0) {
        const convIds = (convData as any[]).map((c: any) => c.id)
        messagesQuery = messagesQuery.in('conversation_id', convIds)
      } else {
        messagesQuery = messagesQuery.eq('id', 'none') // No conversations match
      }
    }

    if (startDate) {
      messagesQuery = messagesQuery.gte('created_at', startDate)
    }
    if (endDate) {
      messagesQuery = messagesQuery.lte('created_at', endDate)
    }

    const { data: messages } = await messagesQuery

    if (messages) {
      for (const msg of messages as any[]) {
        const conv = msg.conversations
        const contactId = conv.lead_id || conv.patient_id
        const contactType = conv.lead_id ? 'lead' : 'patient'
        const contactName = conv.lead_id
          ? leadNames[conv.lead_id] || 'Lead'
          : patientNames[conv.patient_id] || 'Paciente'

        allEvents.push({
          id: msg.id,
          source: 'message',
          event_type: msg.direction === 'inbound' ? 'received' : 'sent',
          description: msg.content || '',
          event_timestamp: msg.created_at,
          contact_id: contactId,
          contact_type: contactType,
          contact_name: contactName,
          metadata: { message_type: msg.message_type, conversation_id: msg.conversation_id },
        })
      }
    }

    // Source 3: Appointments (patients)
    let appointmentsQuery = (supabase
      .from('appointments') as any)
      .select('id, patient_id, lead_id, title, status, scheduled_at, dentist_id, created_at')
      .eq('clinic_id', clinicId)
      .not('patient_id', 'is', null)

    if (contactFilter) {
      appointmentsQuery = appointmentsQuery.eq('patient_id', contactFilter)
    }
    if (startDate) {
      appointmentsQuery = appointmentsQuery.gte('scheduled_at', startDate)
    }
    if (endDate) {
      appointmentsQuery = appointmentsQuery.lte('scheduled_at', endDate)
    }

    const { data: appointments } = await appointmentsQuery

    if (appointments) {
      for (const apt of appointments as any[]) {
        allEvents.push({
          id: apt.id,
          source: 'appointment',
          event_type: apt.status || 'created',
          description: apt.title || 'Appointment',
          event_timestamp: apt.scheduled_at || apt.created_at,
          contact_id: apt.patient_id,
          contact_type: 'patient',
          contact_name: patientNames[apt.patient_id] || 'Paciente',
          metadata: { dentist_id: apt.dentist_id, status: apt.status },
        })
      }
    }

    // Source 4: Patient observations (notes)
    let observationsQuery = (supabase
      .from('patient_observations') as any)
      .select('id, patient_id, content, created_by, created_at')
      .eq('clinic_id', clinicId)

    if (contactFilter) {
      observationsQuery = observationsQuery.eq('patient_id', contactFilter)
    }
    if (startDate) {
      observationsQuery = observationsQuery.gte('created_at', startDate)
    }
    if (endDate) {
      observationsQuery = observationsQuery.lte('created_at', endDate)
    }

    const { data: observations } = await observationsQuery

    if (observations) {
      for (const obs of observations as any[]) {
        allEvents.push({
          id: obs.id,
          source: 'note',
          event_type: 'note',
          description: obs.content || '',
          event_timestamp: obs.created_at,
          contact_id: obs.patient_id,
          contact_type: 'patient',
          contact_name: patientNames[obs.patient_id] || 'Paciente',
          metadata: { created_by: obs.created_by },
        })
      }
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

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching all activities:', error)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}