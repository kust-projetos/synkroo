/**
 * usePayments Hook
 * TanStack Query hooks for payment management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invalidateClinicDomain, queryKeys, useResolvedClinicId } from '@/lib/hooks/use-queries'

export interface Payment {
  id: string
  budget_id: string | null
  amount: number
  payment_method: string
  paid_at: string
  notes: string | null
  created_by: string | null
}

export interface RecordPaymentInput {
  budget_id: string
  amount: number
  payment_method: string
  notes?: string
}

async function fetchPayments(budgetId: string): Promise<Payment[]> {
  const response = await fetch(`/api/financeiro/budgets/${budgetId}/payments`)
  if (!response.ok) {
    throw new Error('Failed to fetch payments')
  }
  const data = await response.json()
  // Canonical returns { data: [...] }, legacy { payments: [...] }
  return data.data ?? data.payments
}

async function recordPayment(input: RecordPaymentInput): Promise<{
  payment: Payment
  sessions_completed: number
  remaining_balance: number
}> {
  const response = await fetch(`/api/financeiro/budgets/${input.budget_id}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      budgetId: input.budget_id,
      amount: input.amount,
      paymentMethod: input.payment_method,
      notes: input.notes,
    }),
  })
  if (!response.ok) {
    throw new Error('Failed to record payment')
  }
  const data = await response.json()
  const payment = data.data ?? data.payment
  return {
    payment,
    sessions_completed: data.sessions_completed ?? 0,
    remaining_balance: data.remaining_balance ?? 0,
  }
}

export function usePayments(budgetId: string | null, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    // G1: key canônica — mesma factory usada em use-queries.ts
    // ('financeiro','payments',budgetId); antes divergia ('payments',budgetId).
    queryKey: queryKeys.budgetPayments(budgetId, resolved),
    queryFn: () => fetchPayments(budgetId!),
    enabled: !!budgetId,
  })
}

export function useRecordPayment() {
  const queryClient = useQueryClient()
  const clinicId = useResolvedClinicId()

  return useMutation({
    mutationFn: recordPayment,
    onSuccess: (data, variables) => {
      // G1: invalidação exata do budget + derivados (antes: predicate
      // amplo `includes(budgetId)` restrito ao tenant).
      const budgetId = data?.payment?.budget_id ?? variables?.budget_id
      if (budgetId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.budgetPayments(budgetId, clinicId) })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard(clinicId) })
      // Derivado sem patientId na mutation: domínio financial-summary da clínica.
      invalidateClinicDomain(queryClient, clinicId, 'financial-summary')
    },
  })
}
