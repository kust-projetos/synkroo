// Date utilities for calendar — constants and helpers

import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  format,
  addDays,
  addWeeks,
  subDays,
  subWeeks,
  addMonths,
  subMonths,
  getDay,
  isToday as dateFnsIsToday,
  isWeekend as dateFnsIsWeekend,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Grid constants (defaults — overridden by store for configurable business hours)
export const DEFAULT_START_HOUR = 8
export const DEFAULT_END_HOUR = 18
export const HOUR_SIZE = 80 // pixels per hour
export const SLOT_MINUTES = 15
export const SLOTS_PER_HOUR = 60 / SLOT_MINUTES // 4
export const SLOT_HEIGHT = HOUR_SIZE / SLOTS_PER_HOUR // 20px
export const MINUTE_HEIGHT = HOUR_SIZE / 60 // ~1.33px per minute

// Legacy constants (used by components not yet migrated)
export const HOURS = Array.from({ length: DEFAULT_END_HOUR - DEFAULT_START_HOUR }, (_, i) => i + DEFAULT_START_HOUR)
export const DAY_START_HOUR = DEFAULT_START_HOUR
export const DAY_END_HOUR = DEFAULT_END_HOUR
export const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60

/** Generate hours array from dynamic start/end */
export function getHoursRange(startHour: number, endHour: number): number[] {
  return Array.from({ length: endHour - startHour }, (_, i) => i + startHour)
}

/** Get minutes from day start for a given hour configuration */
export function getMinutesFromDayStartFor(date: Date, startHour: number): number {
  return getMinutesFromMidnight(date) - startHour * 60
}

/** Get pixel offset for a time within a grid with given start hour */
export function getPixelOffsetFor(date: Date, startHour: number): number {
  return getMinutesFromDayStartFor(date, startHour) * MINUTE_HEIGHT
}

/** Get minutes from midnight for a given date */
export function getMinutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** Get minutes from day start (8:00) */
export function getMinutesFromDayStart(date: Date): number {
  return getMinutesFromMidnight(date) - DAY_START_HOUR * 60
}

/** Get pixel offset for a time within the grid */
export function getPixelOffset(date: Date): number {
  return getMinutesFromDayStart(date) * MINUTE_HEIGHT
}

/** Get pixel height for a duration in minutes */
export function getPixelHeight(durationMinutes: number): number {
  return durationMinutes * MINUTE_HEIGHT
}

/** Format a date key as YYYY-MM-DD */
export function formatDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** Get all days in a week for a given date */
export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 }) // Monday
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end })
}

/** Get all days in a month for a given date */
export function getMonthDays(date: Date): Date[][] {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const allDays = eachDayOfInterval({ start: calStart, end: calEnd })
  const weeks: Date[][] = []
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7))
  }
  return weeks
}

/** Navigate to next/prev date based on view */
export function getNextDate(date: Date, view: string): Date {
  switch (view) {
    case 'day':
    case 'professionals':
      return addDays(date, 1)
    case 'week':
      return addWeeks(date, 1)
    case 'month':
      return addMonths(date, 1)
    default:
      return addDays(date, 1)
  }
}

export function getPrevDate(date: Date, view: string): Date {
  switch (view) {
    case 'day':
    case 'professionals':
      return subDays(date, 1)
    case 'week':
      return subWeeks(date, 1)
    case 'month':
      return subMonths(date, 1)
    default:
      return subDays(date, 1)
  }
}

/** Format date range for toolbar title */
export function formatTitle(date: Date, view: string): string {
  switch (view) {
    case 'day':
    case 'professionals':
      return format(date, "d 'de' MMMM", { locale: ptBR })
    case 'week': {
      const days = getWeekDays(date)
      const first = days[0]
      const last = days[days.length - 1]
      if (first.getMonth() === last.getMonth()) {
        return `${format(first, 'd')} - ${format(last, 'd')} de ${format(first, 'MMMM', { locale: ptBR })}`
      }
      return `${format(first, "d 'de' MMM", { locale: ptBR })} - ${format(last, "d 'de' MMM", { locale: ptBR })}`
    }
    case 'month':
      return format(date, "MMMM 'de' yyyy", { locale: ptBR })
    default:
      return format(date, "d 'de' MMMM", { locale: ptBR })
  }
}

/** Format hour label (e.g. "08:00") */
export function formatHourLabel(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`
}

/** Format time from Date (e.g. "09:30") */
export function formatTime(date: Date): string {
  return format(date, 'HH:mm')
}

/** Check if date is today */
export function isToday(date: Date): boolean {
  return dateFnsIsToday(date)
}

/** Check if date is weekend */
export function isWeekend(date: Date): boolean {
  return dateFnsIsWeekend(date)
}

/** Get day of week (0=Sun, 1=Mon, ..., 6=Sat) */
export function getDayOfWeek(date: Date): number {
  return getDay(date)
}

/** Short day name (Seg, Ter, etc.) */
export function getShortDayName(date: Date): string {
  return format(date, 'EEE', { locale: ptBR })
}

/** Day number */
export function getDayNumber(date: Date): number {
  return date.getDate()
}
