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

export const SLOT_HEIGHT = 80 // pixels per hour
export const MINUTES_PER_PIXEL = 60 / SLOT_HEIGHT

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
