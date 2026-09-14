/**
 * useTreatmentPlans Hook
 * TanStack Query hooks for treatment plan management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateTreatmentPlanInput, TreatmentPlan } from '@/services/treatment-plans/treatment-plan.service'
import { clinicScope, invalidateClinicDomain, useResolvedClinicId } from '@/lib/hooks/use-queries'

const API_BASE = '/api/treatment-plans'

async function fetchTreatmentPlans(patientId: string): Promise<TreatmentPlan[]> {
  const response = await fetch(`${API_BASE}?patient_id=${patientId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch treatment plans')
  }
  const body = await response.json()
  // Contrato canônico (D2 lote 4): { data: { treatment_plans } }
  return body.data.treatment_plans
}

async function fetchTreatmentPlan(id: string): Promise<TreatmentPlan> {
  const response = await fetch(`${API_BASE}/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch treatment plan')
  }
  const body = await response.json()
  return body.data.treatment_plan
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
  return data.data.treatment_plan
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
  return data.data.treatment_plan
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

export function useTreatmentPlans(patientId: string | null, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: clinicScope(resolved, 'treatment-plans', patientId),
    queryFn: () => fetchTreatmentPlans(patientId!),
    enabled: !!patientId,
  })
}

export function useTreatmentPlan(id: string | null, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: clinicScope(resolved, 'treatment-plan', id),
    queryFn: () => fetchTreatmentPlan(id!),
    enabled: !!id,
  })
}

export function useCreateTreatmentPlan() {
  const queryClient = useQueryClient()
  const clinicId = useResolvedClinicId()

  return useMutation({
    mutationFn: createTreatmentPlan,
    onSuccess: (data, variables) => {
      // R4: tenant do input/retorno, senão contexto; escopado ao paciente.
      const tenant = variables?.clinic_id ?? data?.clinic_id ?? clinicId
      invalidateClinicDomain(queryClient, tenant, 'treatment-plans', data.patient_id)
    },
  })
}

export function useUpdateTreatmentPlan() {
  const queryClient = useQueryClient()
  const clinicId = useResolvedClinicId()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateTreatmentPlanInput> }) =>
      updateTreatmentPlan(id, input),
    onSuccess: (data) => {
      // G1: invalidações exatas — detail + lista do paciente (antes: predicates
      // amplos `includes(id)` restritos ao tenant). Tenant do retorno, senão contexto.
      const tenant = data?.clinic_id ?? clinicId
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: clinicScope(tenant, 'treatment-plan', data.id) })
      }
      if (data?.patient_id) {
        queryClient.invalidateQueries({ queryKey: clinicScope(tenant, 'treatment-plans', data.patient_id) })
      }
    },
  })
}

export function useUpdateSession() {
  const queryClient = useQueryClient()
  const clinicId = useResolvedClinicId()

  return useMutation({
    mutationFn: ({ treatmentPlanId, treatmentPlanItemId }: { treatmentPlanId: string; treatmentPlanItemId: string }) =>
      updateSession(treatmentPlanId, treatmentPlanItemId),
    onSuccess: (_, variables) => {
      // G1: invalidação exata do detail (antes: predicate amplo `includes(id)`
      // restrito ao tenant). Lista do paciente indisponível aqui (sem patient_id
      // nas variáveis nem no retorno) — ver FINDINGS.
      if (variables?.treatmentPlanId) {
        queryClient.invalidateQueries({
          queryKey: clinicScope(clinicId, 'treatment-plan', variables.treatmentPlanId),
        })
      }
    },
  })
}