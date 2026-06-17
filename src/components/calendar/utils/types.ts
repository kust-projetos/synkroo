// Calendar types — inspired by Cal.com architecture

import type { AppointmentStatus } from '@/lib/db/types'

/** Origin of an appointment — AI or manual creation/mutation */
export type AppointmentOrigin = 'ai' | 'manual'

/** A single event on the calendar */
export interface CalendarEvent {
  id: string
  title: string // patient name
  start: Date
  end: Date
  dentistId: string
  dentistName: string
  dentistSpecialty?: string
  procedureName: string
  procedureCategory?: string
  status: AppointmentStatus
  durationMinutes: number
  notes?: string | null
  origin?: AppointmentOrigin
  changeSummary?: string
  changeImpact?: string
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

/** Grouping mode for calendar views */
export type CalendarGroupMode = 'professionals' | 'time' | 'status'

/** Density mode for calendar views */
export type CalendarDensityMode = 'compact' | 'comfortable'

/** Layout mode — agenda shows standard grid, professionals shows dentist columns */
export type CalendarLayoutMode = 'agenda' | 'professionals'

/** Dialog state for create/edit */
export interface DialogSlotInfo {
  date: Date
  hour: number
  minute: number
  dentistId?: string
}

/** Context passed when opening the reschedule dialog after a drag-and-drop */
export interface RescheduleInfo {
  eventId: string
  targetDateKey: string
  originalHour: number
  originalMinute: number
}

export interface DialogState {
  open: boolean
  mode: 'create' | 'edit' | 'reschedule'
  slotInfo?: DialogSlotInfo
  eventId?: string
  rescheduleInfo?: RescheduleInfo
  // Pre-fill fields for contact/lead booking
  defaultPatientId?: string
  defaultLeadName?: string
  defaultLeadPhone?: string
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
