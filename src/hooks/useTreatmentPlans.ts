/**
 * useTreatmentPlans Hook
 * TanStack Query hooks for treatment plan management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateTreatmentPlanInput, TreatmentPlan } from '@/services/treatment-plans/treatment-plan.service'

const API_BASE = '/api/treatment-plans'

async function fetchTreatmentPlans(patientId: string): Promise<TreatmentPlan[]> {
  const response = await fetch(`${API_BASE}?patient_id=${patientId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch treatment plans')
  }
  const data = await response.json()
  return data.treatment_plans
}

async function fetchTreatmentPlan(id: string): Promise<TreatmentPlan> {
  const response = await fetch(`${API_BASE}/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch treatment plan')
  }
  const data = await response.json()
  return data.treatment_plan
}

async function createTreatmentPlan(input: CreateTreatmentPlanInput): Promise<TreatmentPlan> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error('Failed to create treatment plan')
  }
  const data = await response.json()
  return data.treatment_plan
}

async function updateTreatmentPlan(id: string, input: Partial<CreateTreatmentPlanInput>): Promise<TreatmentPlan> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error('Failed to update treatment plan')
  }
  const data = await response.json()
  return data.treatment_plan
}

async function updateSession(treatmentPlanId: string, treatmentPlanItemId: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}/${treatmentPlanId}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ treatment_plan_item_id: treatmentPlanItemId }),
  })
  if (!response.ok) {
    throw new Error('Failed to update session')
  }
  return response.json()
}

export function useTreatmentPlans(patientId: string | null) {
  return useQuery({
    queryKey: ['treatment-plans', patientId],
    queryFn: () => fetchTreatmentPlans(patientId!),
    enabled: !!patientId,
  })
}

export function useTreatmentPlan(id: string | null) {
  return useQuery({
    queryKey: ['treatment-plan', id],
    queryFn: () => fetchTreatmentPlan(id!),
    enabled: !!id,
  })
}

export function useCreateTreatmentPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createTreatmentPlan,
    onSuccess: (data) => {
      // Invalidate patient treatment plans list
      queryClient.invalidateQueries({ queryKey: ['treatment-plans', data.patient_id] })
      queryClient.invalidateQueries({ queryKey: ['treatment-plans', null] })
    },
  })
}

export function useUpdateTreatmentPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateTreatmentPlanInput> }) =>
      updateTreatmentPlan(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plan', data.id] })
      queryClient.invalidateQueries({ queryKey: ['treatment-plans', data.patient_id] })
    },
  })
}

export function useUpdateSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ treatmentPlanId, treatmentPlanItemId }: { treatmentPlanId: string; treatmentPlanItemId: string }) =>
      updateSession(treatmentPlanId, treatmentPlanItemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plan', variables.treatmentPlanId] })
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] })
    },
  })
}