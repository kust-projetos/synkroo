/**
 * useFinancialSummary Hook
 * TanStack Query hook for aggregated financial data per patient
 */

import { useQuery } from '@tanstack/react-query'
import type { TreatmentPlan } from '@/services/treatment-plans/treatment-plan.service'
import type { Budget } from '@/services/budgets/budget.service'
import type { BudgetInstallment } from '@/services/installments/installment.service'
import type { Payment } from '@/services/payments/payment.service'

const API_BASE = '/api/treatment-plans'

export interface PlanFinancialSummary {
  plan: TreatmentPlan
  budget: Budget | null
  installments: BudgetInstallment[]
  payments: Payment[]
  billed: number
  paid: number
  owed: number
  sessionsCompleted: number
  sessionsTotal: number
}

export interface FinancialSummary {
  plans: PlanFinancialSummary[]
  totalBilled: number
  totalPaid: number
  totalOwed: number
}

async function fetchFinancialSummary(patientId: string): Promise<FinancialSummary> {
  const response = await fetch(`${API_BASE}?patient_id=${patientId}&include_financials=true`)
  if (!response.ok) {
    throw new Error('Failed to fetch financial summary')
  }
  const body = await response.json()
  // Contrato canônico (D2 lote 4): { data: { financial_summary } }
  return body.data.financial_summary
}

export function useFinancialSummary(patientId: string | null) {
  return useQuery({
    queryKey: ['financial-summary', patientId],
    queryFn: () => fetchFinancialSummary(patientId!),
    enabled: !!patientId,
  })
}
