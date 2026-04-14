import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  getHours,
  getMinutes,
  setHours,
  setMinutes,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const WEEKDAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'] as const

export const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const

// 15-minute slot configuration
export const SLOT_MINUTES = 15
export const SLOTS_PER_HOUR = 60 / SLOT_MINUTES // 4
export const SLOT_HEIGHT = 20 // pixels per 15-min slot
export const MINUTES_PER_PIXEL = SLOT_MINUTES / SLOT_HEIGHT

// Total slots per day (11 hours * 4 slots)
export const TOTAL_SLOTS = HOURS.length * SLOTS_PER_HOUR // 44

// Convert time to slot index
export function timeToSlot(hour: number, minute: number): number {
  return (hour - HOURS[0]) * SLOTS_PER_HOUR + Math.floor(minute / SLOT_MINUTES)
}

// Convert slot index to hour and minute
export function slotToTime(slot: number): { hour: number; minute: number } {
  const adjustedSlot = slot % TOTAL_SLOTS
  const hour = HOURS[0] + Math.floor(adjustedSlot / SLOTS_PER_HOUR)
  const minute = (adjustedSlot % SLOTS_PER_HOUR) * SLOT_MINUTES
  return { hour, minute }
}

// Snap minutes to nearest slot
export function snapToSlot(minute: number): number {
  return Math.round(minute / SLOT_MINUTES) * SLOT_MINUTES
}

export function formatDateHeader(date: Date): string {
  return format(date, "d 'de' MMMM, yyyy", { locale: ptBR })
}

export function formatTime(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end })
}

export function getMonthDays(date: Date): Date[] {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  const days = eachDayOfInterval({ start, end })
  const startDayOfWeek = start.getDay() === 0 ? 6 : start.getDay() - 1
  const paddedStart = addDays(start, -startDayOfWeek)
  const endDayOfWeek = end.getDay() === 0 ? 6 : end.getDay() - 1
  const paddedEnd = addDays(end, 6 - endDayOfWeek)
  return eachDayOfInterval({ start: paddedStart, end: paddedEnd })
}

export function getStartMinutes(date: Date): number {
  return getHours(date) * 60 + getMinutes(date)
}

export function setTime(date: Date, hours: number, minutes: number = 0): Date {
  return setMinutes(setHours(date, hours), minutes)
}

export function formatDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export { isSameDay, isToday, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, format }
