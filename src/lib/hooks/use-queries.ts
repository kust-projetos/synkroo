'use client'

import { useContext } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { isMockMode, getMockForUrl } from '@/lib/mocks'
import { AuthContext } from '@/lib/auth/context'

/**
 * G1: multi-tenant query-key factory.
 * Every clinic-scoped key goes through `clinicScope` so the tenant id is
 * always segment [1]: ['clinic', clinicId, ...rest].
 * Missing clinic resolves to the 'unscoped' sentinel (logged-out / tests
 * without provider) — never silently shares one clinic's cache with another.
 */
export const TENANT_SCOPE = 'clinic' as const
export const UNSCOPED_CLINIC = 'unscoped' as const

export function clinicScope(
  clinicId: string | undefined | null,
  ...segments: readonly unknown[]
) {
  return [TENANT_SCOPE, clinicId ?? UNSCOPED_CLINIC, ...segments] as const
}

/** Backwards-compatible alias required by the G1 spec (`qk.clinicScope`). */
export const qk = { clinicScope, scope: clinicScope } as const

/**
 * Resolve the effective clinic id: explicit param wins, otherwise the
 * current AuthContext profile. Safe outside a provider (returns undefined).
 */
export function useResolvedClinicId(explicit?: string | null): string | undefined {
  const ctx = useContext(AuthContext)
  return explicit ?? ctx?.profile?.clinic_id ?? undefined
}

/**
 * Shared query keys for cache invalidation.
 * G1: ALL multi-tenant keys are tenant-scoped via `clinicScope`.
 * Convention: (params?, clinicId?) — params first for backwards compat;
 * explicit clinicId wins, otherwise hooks resolve it from AuthContext.
 */
export const queryKeys = {
  dashboardStats: (clinicId?: string) => clinicScope(clinicId, 'dashboard', 'stats'),
  patients: (params?: string, clinicId?: string) => clinicScope(clinicId, 'patients', params),
  inactivePatients: (params?: string, clinicId?: string) => clinicScope(clinicId, 'patients', 'inactive', params),
  inactiveStats: (clinicId?: string) => clinicScope(clinicId, 'patients', 'inactive', 'stats'),
  dentists: (clinicId?: string) => clinicScope(clinicId, 'dentists', clinicId),
  procedures: (clinicId?: string) => clinicScope(clinicId, 'procedures', clinicId),
  appointments: (params?: string, clinicId?: string) => clinicScope(clinicId, 'appointments', params),
  leads: (params?: string, clinicId?: string) => clinicScope(clinicId, 'leads', params),
  leadStats: (clinicId?: string) => clinicScope(clinicId, 'leads', 'stats'),
  leadNotifications: (clinicId?: string) => clinicScope(clinicId, 'leads', 'notifications'),
  crmStats: (clinicId?: string) => clinicScope(clinicId, 'crm', 'stats'),
  campaigns: (params?: string, clinicId?: string) => clinicScope(clinicId, 'campaigns', params),
  conversations: (params?: string, clinicId?: string) => clinicScope(clinicId, 'conversations', params),
  conversation: (id: string, clinicId?: string) => clinicScope(clinicId, 'conversations', id),
  analytics: (params?: string, clinicId?: string) => clinicScope(clinicId, 'analytics', params),
  waitlist: (clinicId?: string) => clinicScope(clinicId, 'waitlist'),
  settings: (clinicId?: string) => clinicScope(clinicId, 'settings'),
  patient: (id: string, clinicId?: string) => clinicScope(clinicId, 'patients', id),
  dentist: (id: string, clinicId?: string) => clinicScope(clinicId, 'dentists', id),
  procedure: (id: string, clinicId?: string) => clinicScope(clinicId, 'procedures', id),
  appointment: (id: string, clinicId?: string) => clinicScope(clinicId, 'appointments', id),
  lead: (id: string, clinicId?: string) => clinicScope(clinicId, 'leads', id),
  campaign: (id: string, clinicId?: string) => clinicScope(clinicId, 'campaigns', id),
  contacts: (params?: string, clinicId?: string) => clinicScope(clinicId, 'contacts', params),
  contact: (id: string, type: string, clinicId?: string) => clinicScope(clinicId, 'contacts', id, type),
  contactNotes: (id: string, type: string, clinicId?: string) => clinicScope(clinicId, 'contacts', id, 'notes', type),
  contactAppointments: (contactId: string, clinicId?: string) =>
    clinicScope(clinicId, 'contacts', contactId, 'appointments'),
  calendarEvents: (params?: string, clinicId?: string) => clinicScope(clinicId, 'calendar-events', params),
  customFieldDefinitions: (clinicId?: string) => clinicScope(clinicId, 'custom-field-definitions', clinicId),
  customFieldValues: (contactId: string, contactType: string, clinicId?: string) =>
    clinicScope(clinicId, 'custom-field-values', contactId, contactType),
  contactTimeline: (id: string, type: string, sourceFilter?: string, clinicId?: string) =>
    clinicScope(clinicId, 'contacts', id, 'timeline', type, sourceFilter),
  consents: (contactId: string, contactType: string, clinicId?: string) =>
    clinicScope(clinicId, 'consents', contactId, contactType),
  whatsappMessages: (contactId: string, clinicId?: string) =>
    clinicScope(clinicId, 'whatsapp-messages', contactId),
  kanbanLeads: (clinicId?: string) => clinicScope(clinicId, 'kanban-leads', clinicId),
  pipelineStages: (clinicId?: string) => clinicScope(clinicId, 'pipeline-stages', clinicId),
  leadsByPatient: (patientId: string | null, clinicId?: string) =>
    clinicScope(clinicId, 'leads', 'by-patient', patientId),
  budgets: (clinicId?: string) => clinicScope(clinicId, 'financeiro', 'budgets'),
  budgetPayments: (budgetId: string | null, clinicId?: string) =>
    clinicScope(clinicId, 'financeiro', 'payments', budgetId),
  budget: (budgetId: string, clinicId?: string) =>
    clinicScope(clinicId, 'budget', budgetId),
  collections: (clinicId?: string) => clinicScope(clinicId, 'financeiro', 'collections'),
  gateways: (clinicId?: string) => clinicScope(clinicId, 'financeiro', 'gateways'),
  financeDashboard: (clinicId?: string) => clinicScope(clinicId, 'financeiro', 'dashboard'),
  tasks: (filters?: unknown, clinicId?: string) => clinicScope(clinicId, 'tasks', filters),
  activities: (options?: unknown, clinicId?: string) => clinicScope(clinicId, 'activities', 'all', options),
  duplicates: (clinicId?: string) => clinicScope(clinicId, 'duplicates'),
  duplicateList: (params?: string, clinicId?: string) => clinicScope(clinicId, 'duplicates', 'list', params),
}

/**
 * Generic fetcher with error handling.
 * In mock mode, returns deterministic fixture data instead of making real API calls.
 */
async function fetcher<T>(url: string): Promise<T> {
  if (isMockMode()) {
    const mockData = getMockForUrl(url)
    if (mockData !== null) {
      return mockData as T
    }
    console.warn(`[fetcher] Mock mode active but no fixture for: ${url}, falling back to real fetch`)
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  const json = await response.json()
  // Handle canonical envelope { data: T, meta? } vs legacy plain responses.
  // Unwrap envelope so consumers can uniformly read `data.field`.
  if (json && typeof json === 'object' && !Array.isArray(json) && 'data' in json) {
    const envelope = json as { data: unknown; meta?: unknown }
    // Preserve top-level keys if data is an object that itself contains domain keys,
    // while still exposing envelope meta when relevant. Return inner data for
    // domain queries; meta is available via separate pagination fields when needed.
    return envelope.data as T
  }
  return json as T
}

/**
 * Fetch kanban leads for pipeline
 */
export function fetchKanbanLeads(clinicId: string) {
  return fetcher<{ leads?: any[] }>(`/api/leads/kanban?clinic_id=${clinicId}`).then(r => r.leads ?? [])
}

/**
 * Kanban leads query
 */
export function useKanbanLeads(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.kanbanLeads(resolved),
    queryFn: () => fetchKanbanLeads(resolved!),
    enabled: !!resolved,
  })
}

/**
 * Fetch pipeline stages for kanban
 */
export function fetchPipelineStages(clinicId: string) {
  return fetcher<{ stages?: any[] }>(`/api/pipeline/stages?clinic_id=${clinicId}`).then(r => r.stages ?? [])
}

/**
 * Pipeline stages query
 */
export function usePipelineStages(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.pipelineStages(resolved),
    queryFn: () => fetchPipelineStages(resolved!),
    enabled: !!resolved,
  })
}

/**
 * Dashboard stats — cached for 1 min
 */
export function useDashboardStats(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.dashboardStats(resolved),
    queryFn: () => fetcher<any>('/api/dashboard/stats'),
  })
}

/**
 * Patients list — cached for 1 min, param-based
 */
export function usePatients(params?: Record<string, string>, clinicId?: string) {
  const qs = params ? new URLSearchParams(params).toString() : ''
  const resolved = useResolvedClinicId(clinicId)

  return useQuery({
    queryKey: queryKeys.patients(qs, resolved),
    queryFn: () => fetcher<any>(`/api/patients${qs ? `?${qs}` : ''}`),
    enabled: !!params,
  })
}

/**
 * Inactive patients — cached for 2 min
 */
export function useInactivePatients(minDays = 30, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.inactivePatients(`min_days=${minDays}`, resolved),
    queryFn: () => fetcher<any>(`/api/patients/inactive?min_days=${minDays}`),
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Inactive patients stats — cached for 2 min
 */
export function useInactiveStats(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.inactiveStats(resolved),
    queryFn: () => fetcher<any>('/api/patients/inactive?stats_only=true'),
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Dentists — cached for 5 min (rarely changes)
 */
export function useDentists(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.dentists(resolved),
    queryFn: () => fetcher<any>(`/api/dentists${resolved ? `?clinic_id=${resolved}` : ''}`),
    staleTime: 5 * 60 * 1000,
    enabled: !!resolved,
  })
}

/**
 * Procedures — cached for 5 min (rarely changes)
 */
export function useProcedures(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.procedures(resolved),
    queryFn: () => fetcher<any>(`/api/procedures${resolved ? `?clinic_id=${resolved}` : ''}`),
    staleTime: 5 * 60 * 1000,
    enabled: !!resolved,
  })
}

/**
 * Appointments — cached for 30s (changes frequently)
 */
export function useAppointments(params?: Record<string, string>, clinicId?: string) {
  const qs = params ? new URLSearchParams(params).toString() : ''
  const resolved = useResolvedClinicId(clinicId)

  return useQuery({
    queryKey: queryKeys.appointments(qs, resolved),
    queryFn: () => fetcher<any>(`/api/appointments${qs ? `?${qs}` : ''}`),
    staleTime: 30 * 1000,
    enabled: !!params,
  })
}

/**
 * Leads — cached for 1 min
 */
export function useLeads(params?: Record<string, string>, clinicId?: string) {
  const qs = params ? new URLSearchParams(params).toString() : ''
  const resolved = useResolvedClinicId(clinicId)

  return useQuery({
    queryKey: queryKeys.leads(qs, resolved),
    queryFn: () => fetcher<any>(`/api/leads${qs ? `?${qs}` : ''}`),
    enabled: params !== undefined,
  })
}

/**
 * Campaigns — cached for 1 min
 */
export function useCampaigns(params?: Record<string, string>, clinicId?: string) {
  const qs = params ? new URLSearchParams(params).toString() : ''
  const resolved = useResolvedClinicId(clinicId)

  return useQuery({
    queryKey: queryKeys.campaigns(qs, resolved),
    queryFn: () => fetcher<any>(`/api/campaigns${qs ? `?${qs}` : ''}`),
    enabled: !!params,
  })
}

/**
 * Conversations — cached for 30s, moderate polling for inbound without reload (15s), no background duplication
 */
export function useConversations(params?: Record<string, string>, clinicId?: string) {
  const qs = params ? new URLSearchParams(params).toString() : ''
  const resolved = useResolvedClinicId(clinicId)

  return useQuery({
    queryKey: queryKeys.conversations(qs, resolved),
    queryFn: () => fetcher<any>(`/api/conversations${qs ? `?${qs}` : ''}`),
    staleTime: 30 * 1000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    enabled: !!params,
  })
}

/**
 * Lead stats — cached for 1 min
 */
export function useLeadStats(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.leadStats(resolved),
    queryFn: () => fetcher<any>('/api/leads/stats'),
  })
}

/**
 * CRM stats — cross-module stats for hub
 */
export function useCrmStats(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.crmStats(resolved),
    queryFn: () => fetcher<any>('/api/crm/stats'),
  })
}

/**
 * Lead notifications — cached for 30s
 */
export function useLeadNotifications(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.leadNotifications(resolved),
    queryFn: () => fetcher<any>('/api/leads/notifications'),
    staleTime: 30 * 1000,
  })
}

/**
 * Single entity fetchers
 */
export function usePatient(id: string, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.patient(id, resolved),
    queryFn: () => fetcher<any>(`/api/patients/${id}`),
    enabled: !!id,
  })
}

export function useDentist(id: string, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.dentist(id, resolved),
    queryFn: () => fetcher<any>(`/api/dentists/${id}`),
    enabled: !!id,
  })
}

export function useProcedure(id: string, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.procedure(id, resolved),
    queryFn: () => fetcher<any>(`/api/procedures/${id}`),
    enabled: !!id,
  })
}

export function useAppointment(id: string, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.appointment(id, resolved),
    queryFn: () => fetcher<any>(`/api/appointments/${id}`),
    enabled: !!id,
  })
}

export function useLead(id: string, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.lead(id, resolved),
    queryFn: () => fetcher<any>(`/api/leads/${id}`),
    enabled: !!id,
  })
}

/**
 * Leads filtered by patient_id (for contact detail page)
 */
export function useLeadsByPatient(patientId: string | null, clinicId?: string) {
  const qs = patientId ? new URLSearchParams({ patient_id: patientId }).toString() : ''
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.leadsByPatient(patientId, resolved),
    queryFn: () => fetcher<any>(`/api/leads?${qs}`),
    enabled: !!patientId,
  })
}

export function useCampaign(id: string, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.campaign(id, resolved),
    queryFn: () => fetcher<any>(`/api/campaigns/${id}`),
    enabled: !!id,
  })
}

/**
 * Calendar events — cached for 30s, enriched with joins
 */
export function useCalendarEventsQuery(params?: Record<string, string> | string, clinicId?: string) {
  const qs = typeof params === 'string' ? params : params ? new URLSearchParams(params).toString() : ''
  const resolved = useResolvedClinicId(clinicId)

  return useQuery({
    queryKey: queryKeys.calendarEvents(qs, resolved),
    queryFn: () => fetcher<any>(`/api/appointments${qs ? `?${qs}` : ''}`),
    staleTime: 30 * 1000,
    enabled: !!qs,
  })
}

/**
 * Single conversation with messages — cached for 30s, polling for inbound (15s) without tab duplication
 */
export function useConversation(id: string, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.conversation(id, resolved),
    queryFn: () => fetcher<any>(`/api/conversations/${id}`),
    enabled: !!id,
    staleTime: 30 * 1000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

/**
 * Waitlist — cached for 2 min
 */
export function useWaitlist(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.waitlist(resolved),
    queryFn: () => fetcher<any>('/api/waitlist'),
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Clinic settings — cached for 5 min
 */
export function useClinicSettings(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.settings(resolved),
    queryFn: () => fetcher<any>('/api/clinics/settings'),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Contacts list — cached for 1 min
 */
export function useContacts(params?: Record<string, string>, clinicId?: string) {
  const qs = params ? new URLSearchParams(params).toString() : ''
  const resolved = useResolvedClinicId(clinicId)

  return useQuery({
    queryKey: queryKeys.contacts(qs, resolved),
    queryFn: () => fetcher<any>(`/api/contacts${qs ? `?${qs}` : ''}`),
    staleTime: 60 * 1000,
  })
}

/**
 * Single contact by ID and type
 */
export function useContact(id: string, type: string, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.contact(id, type, resolved),
    queryFn: () => fetcher<any>(`/api/contacts/${id}?type=${type}`),
    enabled: !!id && !!type,
    staleTime: 60 * 1000,
  })
}

/**
 * Contact notes
 */
export function useContactNotes(id: string, type: string, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.contactNotes(id, type, resolved),
    queryFn: () => fetcher<any>(`/api/contacts/${id}/notes?type=${type}`),
    enabled: !!id && !!type,
    staleTime: 30 * 1000,
  })
}

/**
 * Add a note to a contact (CRM owner-bridge).
 * Routes POST → crm.adicionarNotaContato (Task 5).
 */
export function useAddContactNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { type: 'patient' | 'lead'; id: string; content: string }) => {
      const { id, ...body } = input
      const res = await fetch(`/api/contacts/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Failed to add note: ${res.status}`)
      return res.json()
    },
    onSuccess: (_data, variables) => {
      // G1: scoped keys start with ['clinic', ...]; invalidate any tenant's
      // notes for this contact via predicate (mutation has no clinic id).
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey.includes('notes') &&
          q.queryKey.includes(variables.id),
      })
    },
  })
}

/**
 * Update tags of a contact (CRM owner-bridge).
 * Routes PUT → crm.atualizarTagsContato (Task 5).
 */
export function useUpdateContactTags() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { type: 'patient' | 'lead'; id: string; tags: string[] }) => {
      const { id, ...body } = input
      const res = await fetch(`/api/contacts/${id}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Failed to update tags: ${res.status}`)
      return res.json()
    },
    onSuccess: (_data, variables) => {
      // G1: scoped keys — invalidate this contact across tenants via predicate.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey.includes('contacts') &&
          q.queryKey.includes(variables.id),
      })
    },
  })
}

/**
 * Custom field definitions — cached for 5 min
 */
export function useCustomFieldDefinitions(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.customFieldDefinitions(resolved),
    queryFn: () => fetcher<any>(`/api/custom-fields/definitions${resolved ? `?clinic_id=${resolved}` : ''}`),
    staleTime: 5 * 60 * 1000,
    enabled: !!resolved,
  })
}

/**
 * Custom field values for a contact — cached for 1 min
 */
export function useCustomFieldValues(contactId: string, contactType: 'patient' | 'lead', clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.customFieldValues(contactId, contactType, resolved),
    queryFn: () => fetcher<any>(`/api/custom-fields/values?contact_id=${contactId}&contact_type=${contactType}`),
    staleTime: 60 * 1000,
    enabled: !!contactId && !!contactType,
  })
}

/**
 * Contact timeline — infinite query with cursor pagination
 */
export function useContactTimeline(id: string, type: 'patient' | 'lead', sourceFilter?: string, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useInfiniteQuery({
    queryKey: queryKeys.contactTimeline(id, type, sourceFilter, resolved),
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const params = new URLSearchParams({ type })
      if (pageParam) params.set('cursor', pageParam)
      if (sourceFilter) params.set('source', sourceFilter)
      const res = await fetch(`/api/contacts/${id}/timeline?${params}`)
      if (!res.ok) throw new Error('Failed to fetch timeline')
      return res.json()
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: { next_cursor: string | null }) => lastPage.next_cursor ?? undefined,
    enabled: !!id && !!type,
    staleTime: 30 * 1000,
  })
}

// ─── Financeiro hooks (Task 7 — CRM Integration Closure) ────────────────

/**
 * Budgets list — cached for 1 min
 */
export function useBudgets(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.budgets(resolved),
    queryFn: () => fetcher<any>('/api/financeiro/budgets'),
    staleTime: 60 * 1000,
  })
}

/**
 * Payments for a specific budget
 */
export function usePayments(budgetId: string | null, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.budgetPayments(budgetId, resolved),
    queryFn: () => fetcher<any>(`/api/financeiro/budgets/${budgetId}/payments`),
    enabled: !!budgetId,
    staleTime: 30 * 1000,
  })
}

/**
 * Collections (charges) — cached for 30 s
 */
export function useCollections(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.collections(resolved),
    queryFn: () => fetcher<any>('/api/financeiro/collections'),
    staleTime: 30 * 1000,
  })
}

/**
 * Gateways — cached for 5 min
 */
export function useGateways(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.gateways(resolved),
    queryFn: () => fetcher<any>('/api/financeiro/gateways'),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Financeiro dashboard summary — calls GET /api/financeiro/dashboard.
 * Returns { metrics: { budgetConversion, collectionRecovery }, charges: [...] }.
 */
export function useFinanceDashboard(clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.financeDashboard(resolved),
    queryFn: () => fetcher<any>('/api/financeiro/dashboard'),
    staleTime: 30 * 1000,
  })
}

/**
 * Budget status update mutation — canonical (T5): PUT budgets id (no status phantom)
 */
export function useUpdateBudgetStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      const res = await fetch(`/api/financeiro/budgets/${input.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: input.status }),
      })
      if (!res.ok) throw new Error('Failed to update budget status')
      const json: any = await res.json()
      return json.data ?? json
    },
    onSuccess: () => {
      // G1: scoped budgets keys — invalidate any tenant's budgets via predicate.
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('budgets'),
      })
    },
  })
}

// ─── Tasks hooks ────────────────────────────────────────────────────────────

/**
 * Tasks hooks for CRM task management
 */
export function useTasks(filters?: { status?: string; priority?: string; lead_id?: string }, clinicId?: string) {
  const params = new URLSearchParams()
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters?.priority && filters.priority !== 'all') params.set('priority', filters.priority)
  if (filters?.lead_id) params.set('lead_id', filters.lead_id)
  const resolved = useResolvedClinicId(clinicId)

  return useQuery({
    queryKey: queryKeys.tasks(filters, resolved),
    queryFn: () => fetcher<{ tasks: Task[] }>(`/api/tasks?${params}`),
    staleTime: 30 * 1000,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      if (isMockMode()) {
        return { id: `mock-task-new-${Date.now()}`, ...input, created_at: new Date().toISOString() }
      }
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Failed to create task')
      const body = await res.json()
      // Envelope canônico (R2): { data: { task } }
      return body.data ?? body
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('tasks') })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateTaskInput) => {
      if (isMockMode()) {
        return { success: true, ...input, updated_at: new Date().toISOString() }
      }
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Failed to update task')
      const body = await res.json()
      // Envelope canônico (R2): { data: { task } }
      return body.data ?? body
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('tasks') })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      if (isMockMode()) {
        return { success: true, id: taskId, deleted_at: new Date().toISOString() }
      }
      const res = await fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete task')
      const body = await res.json()
      // Envelope canônico (R2): { data: { success } }
      return body.data ?? body
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('tasks') })
    },
  })
}

interface Task {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  lead_id: string | null
  lead_name?: string
  created_at: string
  updated_at: string
}

interface CreateTaskInput {
  title: string
  description?: string
  due_date?: string
  priority?: string
  lead_id?: string
}

interface UpdateTaskInput {
  id: string
  status?: string
  priority?: string
  title?: string
  description?: string
  due_date?: string
  lead_id?: string
}

/**
 * All activities across all contacts — infinite query with cursor pagination
 */
export function useAllActivities(options?: {
  sourceFilter?: string
  contactId?: string
  startDate?: string
  endDate?: string
}, clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useInfiniteQuery({
    queryKey: queryKeys.activities(options, resolved),
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const params = new URLSearchParams()
      if (pageParam) params.set('cursor', pageParam)
      if (options?.sourceFilter) params.set('source', options.sourceFilter)
      if (options?.contactId) params.set('contact_id', options.contactId)
      if (options?.startDate) params.set('start_date', options.startDate)
      if (options?.endDate) params.set('end_date', options.endDate)
      const res = await fetch(`/api/activities?${params}`)
      if (!res.ok) throw new Error('Failed to fetch activities')
      const body = await res.json()
      // Envelope canônico (R2): { data: { events, next_cursor } }
      return body.data ?? body
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: { data?: { next_cursor: string | null }; next_cursor?: string | null }) =>
      lastPage.data?.next_cursor ?? lastPage.next_cursor ?? undefined,
    staleTime: 30 * 1000,
  })
}

/**
 * Contact consents
 */
export function useContactConsents(contactId: string, contactType: 'patient' | 'lead', clinicId?: string) {
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: queryKeys.consents(contactId, contactType, resolved),
    queryFn: () => fetcher<any>(`/api/consents?contact_id=${contactId}&contact_type=${contactType}`),
    enabled: !!contactId && !!contactType,
  })
}

/**
 * Grant consent mutation
 */
export function useGrantConsent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { contact_id: string; contact_type: 'patient' | 'lead'; purpose: string; channel?: string; notes?: string }) => {
      if (isMockMode()) {
        return { id: `mock-consent-${Date.now()}`, ...input, granted: true, granted_at: new Date().toISOString() }
      }
      const res = await fetch('/api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Failed to grant consent')
      return res.json()
    },
  })
}

/**
 * Duplicate suggestions query & mutations
 */
export const duplicateKeys = {
  all: (clinicId?: string) => clinicScope(clinicId, 'duplicates'),
  list: (params?: string, clinicId?: string) => clinicScope(clinicId, 'duplicates', 'list', params),
}

export function useDuplicateSuggestions(params?: { status?: string; ownerType?: string }, clinicId?: string) {
  const paramStr = JSON.stringify(params ?? {})
  const resolved = useResolvedClinicId(clinicId)
  return useQuery({
    queryKey: duplicateKeys.list(paramStr, resolved),
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (params?.status) qs.set('status', params.status)
      if (params?.ownerType) qs.set('owner_type', params.ownerType)
      const res = await fetch(`/api/contacts/duplicates?${qs}`)
      if (!res.ok) throw new Error('Failed to fetch duplicates')
      return res.json()
    },
  })
}

export interface DuplicateTabSuggestion {
  id: string;
  ownerType: string;
  duplicateScore: number;
  confidence: string;
  status: string;
  winnerSuggestedId: string | null;
  leftId?: string;
  rightId?: string;
  leftSnapshot: { id: string; name?: string; document?: string | null };
  rightSnapshot: { id: string; name?: string; document?: string | null };
  signals: Record<string, unknown>;
  detectedAt: Date | string;
}

/**
 * Derive the duplicate suggestion that involves a specific contact from the
 * clinic-wide duplicate list, using the real contact id and owner type.
 * Returns the single selected suggestion (never a literal null) plus query state.
 */
export function useContactDuplicateSuggestion(
  contactId: string,
  contactType: 'patient' | 'lead',
) {
  const { data, isLoading, error } = useDuplicateSuggestions({ ownerType: contactType });

  const rows: DuplicateTabSuggestion[] = Array.isArray(data)
    ? (data as DuplicateTabSuggestion[])
    : (((data as any)?.data as DuplicateTabSuggestion[]) ?? []);

  const selected = rows.find(
    (s) => s.leftId === contactId || s.rightId === contactId,
  );

  return { selected, isLoading, error };
}

export function useApproveSuggestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contacts/duplicates/${id}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to approve')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('duplicates') }),
  })
}

export function useDismissSuggestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await fetch(`/api/contacts/duplicates/${id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss_reason: reason }),
      })
      if (!res.ok) throw new Error('Failed to dismiss')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('duplicates') }),
  })
}

export function useMergeSuggestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contacts/duplicates/${id}/merge`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to merge')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('duplicates') }),
  })
}

/**
 * Revoke consent mutation
 */
export function useRevokeConsent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { contact_id: string; contact_type: 'patient' | 'lead'; purpose: string; channel?: string; notes?: string }) => {
      if (isMockMode()) {
        return { success: true, ...input, revoked_at: new Date().toISOString() }
      }
      const res = await fetch('/api/consents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Failed to revoke consent')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      // G1: consents keys are tenant-scoped; invalidate via predicate.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey.includes('consents') &&
          q.queryKey.includes(variables.contact_id),
      })
    },
  })
}