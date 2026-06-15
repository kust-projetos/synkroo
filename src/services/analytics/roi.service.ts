/**
 * ROI Calculation Service
 * Calculates return on investment metrics for the clinic platform
 */

import { eq, and, gte, lte, lt, gt, inArray, isNotNull, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { conversations, messages, appointments } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export interface ROIMetrics {
  period: { start: string; end: string }
  savings: {
    messagesHandled: number
    avgHandlingTimeMin: number
    hourlyRate: number
    totalSaved: number
  }
  revenue: {
    appointmentsBooked: number
    avgTicket: number
    totalRevenue: number
    recoveredNoShows: number
    recoveredRevenue: number
  }
  costs: {
    platform: number
    tokens: number
    total: number
  }
  roi: number
  netBenefit: number
  comparison?: {
    previousPeriod: ROIMetrics
    changePercent: number
  }
}

interface PeriodRange {
  start: Date
  end: Date
}

// Default financial constants
const DEFAULT_AVG_HANDLING_TIME_MIN = 3
const DEFAULT_HOURLY_RATE = 25
const DEFAULT_AVG_TICKET = 350
const DEFAULT_PLATFORM_COST = 297
const DEFAULT_TOKEN_COST = 0

/**
 * Get date range for a given period
 */
function getPeriodRange(period: string, referenceDate: string): PeriodRange {
  const ref = new Date(referenceDate)

  switch (period) {
    case 'quarter': {
      const start = new Date(ref.getFullYear(), ref.getMonth(), 1)
      const end = new Date(ref.getFullYear(), ref.getMonth() + 3, 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case 'year': {
      const start = new Date(ref.getFullYear(), 0, 1)
      const end = new Date(ref.getFullYear(), 11, 31)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    default: {
      // month
      const start = new Date(ref.getFullYear(), ref.getMonth(), 1)
      const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
  }
}

/**
 * Get the previous period range for comparison
 */
function getPreviousPeriodRange(period: string, referenceDate: string): PeriodRange {
  const ref = new Date(referenceDate)

  switch (period) {
    case 'quarter': {
      const start = new Date(ref.getFullYear(), ref.getMonth() - 3, 1)
      const end = new Date(ref.getFullYear(), ref.getMonth(), 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case 'year': {
      const start = new Date(ref.getFullYear() - 1, 0, 1)
      const end = new Date(ref.getFullYear() - 1, 11, 31)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    default: {
      const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1)
      const end = new Date(ref.getFullYear(), ref.getMonth(), 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
  }
}

/**
 * Count AI-handled messages in period
 * Messages with an intent detected are considered AI-handled
 */
async function countAIHandledMessages(clinicId: string, start: string, end: string): Promise<number> {
  const db = getDb()
  try {
    const convRows = await db.select({ id: conversations.id }).from(conversations)
      .where(and(eq(conversations.clinicId, clinicId), gte(conversations.createdAt, new Date(start)), lte(conversations.createdAt, new Date(end))))
    if (!convRows.length) return 0
    const convIds = convRows.map(c => c.id)
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(messages)
      .where(and(inArray(messages.conversationId, convIds), eq(messages.direction, 'outbound'), isNotNull(messages.intent), gte(messages.createdAt, new Date(start)), lte(messages.createdAt, new Date(end))))
    return row?.count ?? 0
  } catch (e) { dbLogger.error('Error counting AI-handled messages', e); return 0 }
}

/**
 * Count appointments booked through AI (via conversations with scheduling intent)
 */
async function countAIBookedAppointments(clinicId: string, start: string, end: string): Promise<number> {
  const db = getDb()
  try {
    const convRows = await db.select({ id: conversations.id }).from(conversations)
      .where(and(eq(conversations.clinicId, clinicId), gte(conversations.createdAt, new Date(start)), lte(conversations.createdAt, new Date(end))))
    if (!convRows.length) return 0
    const convIds = convRows.map(c => c.id)
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(messages)
      .where(and(inArray(messages.conversationId, convIds), inArray(messages.intent as any, ['schedule_appointment', 'book', 'reschedule', 'confirm_appointment']), gte(messages.createdAt, new Date(start)), lte(messages.createdAt, new Date(end))))
    return row?.count ?? 0
  } catch (e) { dbLogger.error('Error counting AI-booked appointments', e); return 0 }
}

/**
 * Count recovered no-shows
 * Patients who had a no-show and then completed a subsequent appointment
 */
async function countRecoveredNoShows(clinicId: string, start: string, end: string): Promise<number> {
  const db = getDb()
  try {
    const nsRows = await db.select({ patientId: appointments.patientId }).from(appointments)
      .where(and(eq(appointments.clinicId, clinicId), eq(appointments.status as any, 'no_show'), lt(appointments.scheduledAt, new Date(start))))
    const patientIds = [...new Set(nsRows.map(r => r.patientId).filter(Boolean))] as string[]
    if (!patientIds.length) return 0
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(appointments)
      .where(and(eq(appointments.clinicId, clinicId), inArray(appointments.patientId, patientIds), eq(appointments.status as any, 'completed'), gte(appointments.scheduledAt, new Date(start)), lte(appointments.scheduledAt, new Date(end))))
    return row?.count ?? 0
  } catch (e) { dbLogger.error('Error counting recovered no-shows', e); return 0 }
}

/**
 * Calculate ROI metrics for a given period
 */
export async function calculateROI(
  clinicId: string,
  periodStart: string,
  periodEnd: string
): Promise<ROIMetrics> {
  const [messagesHandled, appointmentsBooked, recoveredNoShows] = await Promise.all([
    countAIHandledMessages(clinicId, periodStart, periodEnd),
    countAIBookedAppointments(clinicId, periodStart, periodEnd),
    countRecoveredNoShows(clinicId, periodStart, periodEnd),
  ])

  const savingsTotal = messagesHandled * DEFAULT_AVG_HANDLING_TIME_MIN * (DEFAULT_HOURLY_RATE / 60)
  const appointmentsRevenue = appointmentsBooked * DEFAULT_AVG_TICKET
  const recoveredRevenue = recoveredNoShows * DEFAULT_AVG_TICKET
  const totalRevenue = appointmentsRevenue + recoveredRevenue
  const totalCosts = DEFAULT_PLATFORM_COST + DEFAULT_TOKEN_COST

  const netBenefit = savingsTotal + totalRevenue - totalCosts
  const roi = totalCosts > 0 ? (netBenefit / totalCosts) * 100 : 0

  return {
    period: { start: periodStart, end: periodEnd },
    savings: {
      messagesHandled,
      avgHandlingTimeMin: DEFAULT_AVG_HANDLING_TIME_MIN,
      hourlyRate: DEFAULT_HOURLY_RATE,
      totalSaved: Math.round(savingsTotal * 100) / 100,
    },
    revenue: {
      appointmentsBooked,
      avgTicket: DEFAULT_AVG_TICKET,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      recoveredNoShows,
      recoveredRevenue: Math.round(recoveredRevenue * 100) / 100,
    },
    costs: {
      platform: DEFAULT_PLATFORM_COST,
      tokens: DEFAULT_TOKEN_COST,
      total: totalCosts,
    },
    roi: Math.round(roi * 100) / 100,
    netBenefit: Math.round(netBenefit * 100) / 100,
  }
}

/**
 * Get ROI metrics with period comparison
 */
export async function getROIMetrics(
  clinicId: string,
  period: string = 'month',
  date: string = new Date().toISOString().split('T')[0]
): Promise<ROIMetrics> {
  try {
    const { start, end } = getPeriodRange(period, date)
    const startStr = start.toISOString()
    const endStr = end.toISOString()

    // Get previous period for comparison
    const prevRange = getPreviousPeriodRange(period, date)
    const prevStartStr = prevRange.start.toISOString()
    const prevEndStr = prevRange.end.toISOString()

    // Run both period calculations in parallel to reduce latency
    const [currentMetrics, previousMetrics] = await Promise.all([
      calculateROI(clinicId, startStr, endStr),
      calculateROI(clinicId, prevStartStr, prevEndStr),
    ])

    const changePercent =
      previousMetrics.roi !== 0
        ? ((currentMetrics.roi - previousMetrics.roi) / Math.abs(previousMetrics.roi)) * 100
        : currentMetrics.roi > 0 ? 100 : 0

    return {
      ...currentMetrics,
      comparison: {
        previousPeriod: previousMetrics,
        changePercent: Math.round(changePercent * 100) / 100,
      },
    }
  } catch (error) {
    dbLogger.error('Error calculating ROI metrics', error)
    // Return empty metrics on error
    return {
      period: { start: date, end: date },
      savings: {
        messagesHandled: 0,
        avgHandlingTimeMin: DEFAULT_AVG_HANDLING_TIME_MIN,
        hourlyRate: DEFAULT_HOURLY_RATE,
        totalSaved: 0,
      },
      revenue: {
        appointmentsBooked: 0,
        avgTicket: DEFAULT_AVG_TICKET,
        totalRevenue: 0,
        recoveredNoShows: 0,
        recoveredRevenue: 0,
      },
      costs: {
        platform: DEFAULT_PLATFORM_COST,
        tokens: DEFAULT_TOKEN_COST,
        total: DEFAULT_PLATFORM_COST,
      },
      roi: 0,
      netBenefit: 0,
    }
  }
}
