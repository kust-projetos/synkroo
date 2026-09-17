/**
 * useTreatmentPlans Hook
 * TanStack Query hooks for treatment plan management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateTreatmentPlanInput, TreatmentPlan } from '@/services/treatment-plans/treatment-plan.service'
import { invalidateClinicDomain, queryKeys, useResolvedClinicId } from '@/lib/hooks/use-queries'

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

async function updateSession(
  treatmentPlanId: string,
  treatmentPlanItemId: string,
): Promise<{ treatment_plan_item: unknown; patient_id?: string | null }> {
  const response = await fetch(`${API_BASE}/${treatmentPlanId}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ treatment_plan_item_id: treatmentPlanItemId }),
  })
  if (!response.ok) {
    throw new Error('Failed to update session')
  }
  const body = await response.json()
  // Contrato canônico (D2): { data: { treatment_plan_item, patient_id } }
  return body.data ?? body
}

export function useTreatmentPlans(patientId: string | null, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.treatmentPlans(patientId, resolved),
    queryFn: () => fetchTreatmentPlans(patientId!),
    enabled: !!patientId,
  })
}

export function useTreatmentPlan(id: string | null, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.treatmentPlan(id!, resolved),
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
        queryClient.invalidateQueries({ queryKey: queryKeys.treatmentPlan(data.id, tenant) })
      }
      if (data?.patient_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.treatmentPlans(data.patient_id, tenant) })
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
    onSuccess: (data, variables) => {
      // Etapa 1: detail + lista do paciente + resumo financeiro — patient_id vem
      // do servidor (somente cache), nunca do cliente. Sem wildcard global.
      if (variables?.treatmentPlanId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.treatmentPlan(variables.treatmentPlanId, clinicId),
        })
      }
      const patientId = data?.patient_id ?? null
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.treatmentPlans(patientId, clinicId),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.financialSummary(patientId, clinicId),
        })
      }
    },
  })
}