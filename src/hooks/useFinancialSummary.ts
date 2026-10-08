/**
 * useFinancialSummary Hook
 * TanStack Query hook for aggregated financial data per patient
 */

import { useQuery } from '@tanstack/react-query'
import type { TreatmentPlan } from '@/services/treatment-plans/treatment-plan.service'
import { clinicScope, useResolvedClinicId } from '@/lib/hooks/use-queries'

const API_BASE = '/api/treatment-plans'

// Interfaces locais mínimas (S6): espelham apenas os campos do payload de
// GET /api/treatment-plans?include_financials consumidos via PlanFinancialSummary
// (contact-financial-tab.tsx usa plan.{id,title,status}, budget?.id e os
// escalares billed/paid/owed/sessions*). Sem importar os services legados.
export interface BudgetSummary {
  id?: string
}

export interface PlanBudgetInstallment {
  id?: string
  budget_id: string
  amount: number
  due_date: string
  status: string
  paid_at?: string | null
}

export interface PlanPayment {
  id?: string
  budget_id: string | null
  amount: number
  payment_method: string
  paid_at: string
  // Omitido pelo payload de include_financials (minimização de PII); mantido
  // opcional para compatibilidade com outros leitores do tipo.
  notes?: string | null
}

export interface PlanFinancialSummary {
  plan: TreatmentPlan
  budget: BudgetSummary | null
  installments: PlanBudgetInstallment[]
  payments: PlanPayment[]
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

export function useFinancialSummary(patientId: string | null, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: clinicScope(resolved, 'financial-summary', patientId),
    queryFn: () => fetchFinancialSummary(patientId!),
    enabled: !!patientId,
  })
}
