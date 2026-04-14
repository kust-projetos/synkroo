import type { CalendarEvent } from '../hooks/useCalendarEvents'

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

export interface Appointment {
  id: string
  title: string
  status: AppointmentStatus
  procedureName: string
  durationMinutes: number
  patientPhone?: string
  startMinutes: number
  dentistId: string
  isBlocked?: boolean
}

export interface StatusColorSet {
  bg: string
  bgEnd: string
  badge: string
  badgeText: string
}

export const STATUS_COLORS: Record<AppointmentStatus, StatusColorSet> = {
  scheduled: { bg: '#F59E0B', bgEnd: '#D97706', badge: 'rgba(255,255,255,0.2)', badgeText: 'white' },
  confirmed: { bg: '#14B8A6', bgEnd: '#0D9488', badge: '#22C55E', badgeText: 'white' },
  in_progress: { bg: '#22C55E', bgEnd: '#16A34A', badge: 'rgba(255,255,255,0.25)', badgeText: 'white' },
  completed: { bg: '#6B7280', bgEnd: '#4B5563', badge: 'rgba(255,255,255,0.15)', badgeText: 'white' },
  cancelled: { bg: '#EF4444', bgEnd: '#DC2626', badge: 'rgba(255,255,255,0.2)', badgeText: 'white' },
  no_show: { bg: '#EF4444', bgEnd: '#DC2626', badge: 'rgba(255,255,255,0.2)', badgeText: 'white' },
}

export const STATUS_ICONS: Record<AppointmentStatus, string> = {
  scheduled: '⏳',
  confirmed: '✓',
  in_progress: '▶',
  completed: '✓',
  cancelled: '✕',
  no_show: '✕',
}

export function getStatusColors(status: string): StatusColorSet {
  return STATUS_COLORS[status as AppointmentStatus] || STATUS_COLORS['scheduled']
}

export function getStatusIcon(status: string): string {
  return STATUS_ICONS[status as AppointmentStatus] || '⏳'
}

export function isEditableStatus(status: string): boolean {
  return ['scheduled', 'confirmed', 'in_progress'].includes(status)
}

export function isCancelledStatus(status: string): boolean {
  return ['cancelled', 'no_show'].includes(status)
}

export function eventToAppointment(event: CalendarEvent, date: Date): Appointment {
  const startDate = new Date(event.start)
  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes()

  return {
    id: event.id,
    title: event.title,
    status: event.extendedProps.status as AppointmentStatus,
    procedureName: event.extendedProps.procedureName,
    durationMinutes: event.extendedProps.durationMinutes,
    patientPhone: event.extendedProps.patientPhone || undefined,
    startMinutes,
    dentistId: event.resourceId,
    isBlocked: event.extendedProps.isBlocked === true,
  }
}

export function groupAppointmentsByHour(appointments: Appointment[]): Map<number, Appointment[]> {
  const grouped = new Map<number, Appointment[]>()
  appointments.forEach(apt => {
    const hour = Math.floor(apt.startMinutes / 60)
    const existing = grouped.get(hour) || []
    grouped.set(hour, [...existing, apt])
  })
  return grouped
}

export function groupAppointmentsByDentist(appointments: Appointment[]): Map<string, Appointment[]> {
  const grouped = new Map<string, Appointment[]>()
  appointments.forEach(apt => {
    const existing = grouped.get(apt.dentistId) || []
    grouped.set(apt.dentistId, [...existing, apt])
  })
  return grouped
}
