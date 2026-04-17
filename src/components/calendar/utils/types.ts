// Calendar types — inspired by Cal.com architecture

import type { AppointmentStatus } from '@/lib/supabase/database.types'

/** A single event on the calendar */
export interface CalendarEvent {
  id: string
  title: string // patient name
  start: Date
  end: Date
  dentistId: string
  dentistName: string
  procedureName: string
  status: AppointmentStatus
  durationMinutes: number
  notes?: string | null
}

/** A resource column (dentist) in the calendar */
export interface CalendarResource {
  id: string
  name: string
  color: string
  specialty?: string
}

/** Calendar view modes */
export type CalendarView = 'day' | 'week' | 'month' | 'professionals' | 'list'

/** Dialog state for create/edit */
export interface DialogSlotInfo {
  date: Date
  hour: number
  minute: number
  dentistId?: string
}

export interface DialogState {
  open: boolean
  mode: 'create' | 'edit'
  slotInfo?: DialogSlotInfo
  eventId?: string
}

/** Laid-out event after overlap calculation */
export interface LaidOutEvent {
  event: CalendarEvent
  column: number
  totalColumns: number
}

/** Props for time-grid based views */
export interface TimeGridViewProps {
  events: CalendarEvent[]
  resources?: CalendarResource[]
  date: Date
}
