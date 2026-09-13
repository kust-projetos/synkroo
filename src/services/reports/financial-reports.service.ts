/**
 * Financial Reports Service
 * Provides aggregation functions for financial analytics
 *
 * Supports REPORT-05: Financial reports by period
 * Supports REPORT-03: Identify inactive patients
 * Supports REPORT-04: Upsell/upgrade opportunities
 */

import { eq, and, gte, lte, lt, or, isNull, inArray, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { budgets, budgetItems, payments, patients, treatmentPlans } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

// ─── Types ───────────────────────────────────────────────────────────────────

export type PeriodType = 'month' | 'quarter' | 'year'

export interface FinancialReport {
  period: string // e.g., "2026-04"
  revenue: number // sum of budgets.final_value where status = 'accepted' in period
  payments: number // sum of payments.amount received in period
  outstanding: number // revenue - payments
  byProcedure: ProcedureBreakdown[]
}

export interface ProcedureBreakdown {
  procedureId: string
  procedureName: string
  revenue: number
  payments: number
}

export interface InactivePatient {
  patientId: string
  patientName: string
  patientPhone: string
  lastVisit: Date
  daysSinceVisit: number
}

export interface UpsellOpportunity {
  patientId: string
  patientName: string
  lastTreatment: string
  daysSinceCompletion: number
  lastBudgetId: string
}

// ─── Period Helpers ───────────────────────────────────────────────────────────

/**
 * Calculate period start and end dates
 */
function getPeriodBounds(period: PeriodType, date: Date): { start: Date; end: Date } {
  const year = date.getFullYear()
  const month = date.getMonth()

  switch (period) {
    case 'month': {
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
      return { start, end }
    }
    case 'quarter': {
      const quarterStart = Math.floor(month / 3) * 3
      const start = new Date(year, quarterStart, 1)
      const end = new Date(year, quarterStart + 3, 0, 23, 59, 59, 999)
      return { start, end }
    }
    case 'year': {
      const start = new Date(year, 0, 1)
      const end = new Date(year, 11, 31, 23, 59, 59, 999)
      return { start, end }
    }
  }
}

/**
 * Format period for display
 */
function formatPeriodString(period: PeriodType, date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth()

  switch (period) {
    case 'month':
      return `${year}-${String(month + 1).padStart(2, '0')}`
    case 'quarter': {
      const quarter = Math.floor(month / 3) + 1
      return `${year}-Q${quarter}`
    }
    case 'year':
      return `${year}`
  }
}

// ─── Financial Report ─────────────────────────────────────────────────────────

/**
 * Get financial report for a clinic in a given period
 *
 * @param clinicId - The clinic's UUID
 * @param period - Period type: 'month', 'quarter', or 'year'
 * @param date - Reference date for the period (defaults to today)
 * @returns FinancialReport with revenue, payments, outstanding, and procedure breakdown
 */
export async function getFinancialReport(clinicId: string, period: PeriodType, date: Date = new Date()): Promise<FinancialReport> {
  const db = getDb()
  try {
    const { start, end } = getPeriodBounds(period, date)
    // Revenue: accepted budgets within period
    const budgetRows = await db
      .select({ id: budgets.id, finalValue: budgets.finalValue, createdAt: budgets.createdAt })
      .from(budgets)
      .where(and(eq(budgets.clinicId, clinicId), eq(budgets.status as any, 'accepted'), gte(budgets.createdAt, start), lte(budgets.createdAt, end)))

    // Budget items for procedure breakdown
    const budgetIds = budgetRows.map(b => b.id)
    let itemRows: any[] = []
    if (budgetIds.length) {
      itemRows = await db
        .select({ budgetId: budgetItems.budgetId, procedureId: budgetItems.procedureId, procedureName: budgetItems.procedureName, totalPrice: budgetItems.totalPrice })
        .from(budgetItems).where(inArray(budgetItems.budgetId, budgetIds))
    }

    // Payments received within period — tenant-scoped
    const paymentRows = await db
      .select({ amount: payments.amount, paidAt: payments.paidAt, budgetId: payments.budgetId })
      .from(payments).where(and(eq(payments.clinicId, clinicId), gte(payments.paidAt, start), lte(payments.paidAt, end)))

    let revenue = 0
    const procMap = new Map<string, ProcedureBreakdown>()
    for (const b of budgetRows) {
      revenue += Number(b.finalValue ?? 0)
      for (const item of itemRows.filter(i => i.budgetId === b.id)) {
        const pid = item.procedureId || 'unknown'
        let breakdown = procMap.get(pid)
        if (!breakdown) { breakdown = { procedureId: pid, procedureName: item.procedureName || 'Procedimento', revenue: 0, payments: 0 }; procMap.set(pid, breakdown) }
        breakdown.revenue += Number(item.totalPrice ?? 0)
      }
    }

    let totalPayments = 0
    for (const p of paymentRows) {
      totalPayments += Number(p.amount ?? 0)
      if (p.budgetId) {
        const bgt = budgetRows.find(b => b.id === p.budgetId)
        if (bgt) {
          const items = itemRows.filter(i => i.budgetId === bgt.id)
          for (const item of items) {
            const breakdown = procMap.get(item.procedureId || 'unknown')
            if (breakdown && Number(bgt.finalValue) > 0) {
              breakdown.payments += Number(p.amount ?? 0) * (Number(item.totalPrice ?? 0) / Number(bgt.finalValue))
            }
          }
        }
      }
    }

    const outstanding = revenue - totalPayments
    return {
      period: formatPeriodString(period, date),
      revenue: Math.round(revenue * 100) / 100,
      payments: Math.round(totalPayments * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      byProcedure: [...procMap.values()].map(b => ({ ...b, revenue: Math.round(b.revenue * 100) / 100, payments: Math.round(b.payments * 100) / 100 })),
    }
  } catch (error) {
    dbLogger.error('Error in getFinancialReport', error)
    return { period: formatPeriodString(period, date), revenue: 0, payments: 0, outstanding: 0, byProcedure: [] }
  }
}

// ─── Inactive Patients ────────────────────────────────────────────────────────

/**
 * Get patients who have not visited in the specified number of days
 *
 * @param clinicId - The clinic's UUID
 * @param daysThreshold - Days since last visit to be considered inactive (default: 90)
 * @returns Array of InactivePatient sorted by days since visit
 */
export async function getInactivePatients(clinicId: string, daysThreshold: number = 90): Promise<InactivePatient[]> {
  const db = getDb()
  try {
    const thresholdDate = new Date(); thresholdDate.setDate(thresholdDate.getDate() - daysThreshold)
    const rows = await db.select({ id: patients.id, name: patients.name, phone: patients.phone, lastVisitAt: patients.lastVisitAt, createdAt: patients.createdAt })
      .from(patients).where(and(eq(patients.clinicId, clinicId), isNull(patients.deletedAt), or(isNull(patients.lastVisitAt), lt(patients.lastVisitAt, thresholdDate))))
    const now = new Date()
    return rows.map(p => {
      const lastVisit = p.lastVisitAt || p.createdAt || new Date()
      return { patientId: p.id, patientName: p.name, patientPhone: p.phone, lastVisit, daysSinceVisit: Math.floor((now.getTime() - new Date(lastVisit).getTime()) / 86400000) }
    }).sort((a, b) => b.daysSinceVisit - a.daysSinceVisit)
  } catch (e) { dbLogger.error('Error in getInactivePatients', e); return [] }
}

// ─── Upsell Opportunities ─────────────────────────────────────────────────────

/**
 * Get patients with completed treatments but no active follow-up budget
 *
 * Identifies opportunities for upselling based on:
 * - Treatment completed more than specified days ago
 * - No active or draft budget for follow-up
 *
 * @param clinicId - The clinic's UUID
 * @param daysThreshold - Days since treatment completion (default: 30)
 * @returns Array of UpsellOpportunity sorted by days since completion
 */
export async function getUpsellOpportunities(clinicId: string, daysThreshold: number = 30): Promise<UpsellOpportunity[]> {
  const db = getDb()
  try {
    const thresholdDate = new Date(); thresholdDate.setDate(thresholdDate.getDate() - daysThreshold)
    const planRows = await db
      .select({ id: treatmentPlans.id, patientId: treatmentPlans.patientId, title: treatmentPlans.title, completedAt: treatmentPlans.completedAt, lastSessionAt: treatmentPlans.lastSessionAt, patientName: patients.name })
      .from(treatmentPlans).leftJoin(patients, eq(treatmentPlans.patientId, patients.id))
      .where(and(eq(treatmentPlans.clinicId, clinicId), eq(treatmentPlans.status as any, 'completed'), or(lt(treatmentPlans.completedAt, thresholdDate), lt(treatmentPlans.lastSessionAt, thresholdDate))))

    const opps: UpsellOpportunity[] = []
    for (const p of planRows) {
      const activeRows = await db.select({ id: budgets.id }).from(budgets)
        .where(and(eq(budgets.clinicId, clinicId), eq(budgets.patientId, p.patientId), inArray(budgets.status as any, ['draft', 'active', 'sent'])))
      if (activeRows.length > 0) continue
      const completionDate = p.completedAt || p.lastSessionAt || new Date()
      opps.push({ patientId: p.patientId, patientName: p.patientName || 'Unknown', lastTreatment: p.title, daysSinceCompletion: Math.floor((Date.now() - new Date(completionDate).getTime()) / 86400000), lastBudgetId: p.id })
    }
    return opps.sort((a, b) => b.daysSinceCompletion - a.daysSinceCompletion)
  } catch (e) { dbLogger.error('Error in getUpsellOpportunities', e); return [] }
}
