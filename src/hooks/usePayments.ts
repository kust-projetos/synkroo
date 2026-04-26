/**
 * usePayments Hook
 * TanStack Query hooks for payment management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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
  const response = await fetch(`/api/budgets/${budgetId}/payments`)
  if (!response.ok) {
    throw new Error('Failed to fetch payments')
  }
  const data = await response.json()
  return data.payments
}

async function recordPayment(input: RecordPaymentInput): Promise<{
  payment: Payment
  sessions_completed: number
  remaining_balance: number
}> {
  const response = await fetch(`/api/budgets/${input.budget_id}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error('Failed to record payment')
  }
  return response.json()
}

export function usePayments(budgetId: string | null) {
  return useQuery({
    queryKey: ['payments', budgetId],
    queryFn: () => fetchPayments(budgetId!),
    enabled: !!budgetId,
  })
}

export function useRecordPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: recordPayment,
    onSuccess: (data) => {
      // Invalidate payments list for this budget
      queryClient.invalidateQueries({ queryKey: ['payments', data.payment.budget_id] })
      // Invalidate budget to reflect new status
      queryClient.invalidateQueries({ queryKey: ['budget', data.payment.budget_id] })
    },
  })
}
