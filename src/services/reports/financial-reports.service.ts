/**
 * Financial Reports Service
 * Provides aggregation functions for financial analytics
 *
 * Supports REPORT-05: Financial reports by period
 * Supports REPORT-03: Identify inactive patients
 * Supports REPORT-04: Upsell/upgrade opportunities
 */

import { createTypedClient } from '@/lib/supabase/typed'
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
export async function getFinancialReport(
  clinicId: string,
  period: PeriodType,
  date: Date = new Date()
): Promise<FinancialReport> {
  const supabase = await createTypedClient()

  try {
    const { start, end } = getPeriodBounds(period, date)
    const startStr = start.toISOString()
    const endStr = end.toISOString()

    // Revenue: accepted budgets within period (using accepted_at or created_at)
    const { data: acceptedBudgets, error: budgetError } = await supabase
      .from('budgets')
      .select(`
        id,
        final_value,
        accepted_at,
        created_at,
        budget_items (procedure_id, procedure_name)
      `)
      .eq('clinic_id', clinicId)
      .eq('status', 'accepted')
      .gte('created_at', startStr)
      .lte('created_at', endStr)

    if (budgetError) {
      dbLogger.error('Error fetching accepted budgets', budgetError)
    }

    // Get payments received within period (source of truth per RESEARCH.md pitfall #4)
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount, paid_at, budget_id')
      .gte('paid_at', startStr)
      .lte('paid_at', endStr)

    if (paymentsError) {
      dbLogger.error('Error fetching payments', paymentsError)
    }

    // Calculate revenue from accepted budgets
    let revenue = 0
    const procedureMap = new Map<string, ProcedureBreakdown>()

    for (const budget of acceptedBudgets || []) {
      revenue += budget.final_value || 0

      // Aggregate by procedure
      for (const item of (Array.isArray(budget.budget_items) ? budget.budget_items : budget.budget_items ? [budget.budget_items] : [])) {
        const procId = item.procedure_id || 'unknown'
        const procName = item.procedure_name || 'Procedimento'

        let breakdown = procedureMap.get(procId)
        if (!breakdown) {
          breakdown = {
            procedureId: procId,
            procedureName: procName,
            revenue: 0,
            payments: 0,
          }
          procedureMap.set(procId, breakdown)
        }
        breakdown.revenue += item.total_price || 0
      }
    }

    // Calculate payments received
    let totalPayments = 0
    for (const payment of payments || []) {
      totalPayments += payment.amount || 0

      // If payment is linked to a budget, attribute to procedure
      if (payment.budget_id) {
        const budget = acceptedBudgets?.find((b: { id: string }) => b.id === payment.budget_id)
        if (budget) {
          for (const item of (Array.isArray(budget.budget_items) ? budget.budget_items : budget.budget_items ? [budget.budget_items] : [])) {
            const procId = item.procedure_id || 'unknown'
            const breakdown = procedureMap.get(procId)
            if (breakdown) {
              // Distribute payment proportionally
              const proportion = (item.total_price || 0) / budget.final_value
              breakdown.payments += (payment.amount || 0) * proportion
            }
          }
        }
      }
    }

    // Calculate outstanding
    const outstanding = revenue - totalPayments

    // Convert procedure map to array
    const byProcedure = Array.from(procedureMap.values()).map(b => ({
      ...b,
      revenue: Math.round(b.revenue * 100) / 100,
      payments: Math.round(b.payments * 100) / 100,
    }))

    return {
      period: formatPeriodString(period, date),
      revenue: Math.round(revenue * 100) / 100,
      payments: Math.round(totalPayments * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      byProcedure,
    }
  } catch (error) {
    dbLogger.error('Error in getFinancialReport', error)
    return {
      period: formatPeriodString(period, date),
      revenue: 0,
      payments: 0,
      outstanding: 0,
      byProcedure: [],
    }
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
export async function getInactivePatients(
  clinicId: string,
  daysThreshold: number = 90
): Promise<InactivePatient[]> {
  const supabase = await createTypedClient()

  try {
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold)
    const thresholdStr = thresholdDate.toISOString()

    // Get patients with no appointments after threshold date
    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, name, phone, last_visit_at, created_at')
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .or(`last_visit_at.lt.${thresholdStr},last_visit_at.is.null`)

    if (error) {
      dbLogger.error('Error fetching inactive patients', error)
      return []
    }

    const now = new Date()
    const inactive: InactivePatient[] = []

    for (const patient of patients || []) {
      const lastVisit = patient.last_visit_at
        ? new Date(patient.last_visit_at)
        : new Date(patient.created_at)

      const daysSince = Math.floor(
        (now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24)
      )

      inactive.push({
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        lastVisit,
        daysSinceVisit: daysSince,
      })
    }

    // Sort by days since visit (most inactive first)
    inactive.sort((a, b) => b.daysSinceVisit - a.daysSinceVisit)

    return inactive
  } catch (error) {
    dbLogger.error('Error in getInactivePatients', error)
    return []
  }
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
export async function getUpsellOpportunities(
  clinicId: string,
  daysThreshold: number = 30
): Promise<UpsellOpportunity[]> {
  const supabase = await createTypedClient()

  try {
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold)
    const thresholdStr = thresholdDate.toISOString()

    // Get completed treatment plans
    const { data: completedPlans, error: plansError } = await supabase
      .from('treatment_plans')
      .select(`
        id,
        patient_id,
        title,
        completed_at,
        last_session_at,
        patients (name)
      `)
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .or(`completed_at.lt.${thresholdStr},last_session_at.lt.${thresholdStr}`)

    if (plansError) {
      dbLogger.error('Error fetching completed treatment plans', plansError)
      return []
    }

    const opportunities: UpsellOpportunity[] = []

    for (const plan of completedPlans || []) {
      // Check if patient has active budget (status not in ['draft', 'active', 'sent'])
      const { data: activeBudgets, error: budgetError } = await supabase
        .from('budgets')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('patient_id', plan.patient_id)
        .in('status', ['draft', 'active', 'sent'])

      if (budgetError) {
        dbLogger.error('Error checking active budgets', budgetError)
        continue
      }

      // If no active budget, this is an upsell opportunity
      if (!activeBudgets || activeBudgets.length === 0) {
        const completionDate = plan.completed_at
          ? new Date(plan.completed_at)
          : plan.last_session_at
            ? new Date(plan.last_session_at)
            : new Date()

        const daysSince = Math.floor(
          (new Date().getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        opportunities.push({
          patientId: plan.patient_id,
          patientName: plan.patients?.name || 'Unknown',
          lastTreatment: plan.title,
          daysSinceCompletion: daysSince,
          lastBudgetId: plan.id,
        })
      }
    }

    // Sort by days since completion (oldest first - most urgent)
    opportunities.sort((a, b) => b.daysSinceCompletion - a.daysSinceCompletion)

    return opportunities
  } catch (error) {
    dbLogger.error('Error in getUpsellOpportunities', error)
    return []
  }
}
