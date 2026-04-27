'use client'

import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { createTypedClient } from '@/lib/supabase/typed'

/**
 * Shared query keys for cache invalidation
 */
export const queryKeys = {
  dashboardStats: ['dashboard', 'stats'] as const,
  patients: (params?: string) => ['patients', params] as const,
  inactivePatients: (params?: string) => ['patients', 'inactive', params] as const,
  inactiveStats: ['patients', 'inactive', 'stats'] as const,
  dentists: (clinicId?: string) => ['dentists', clinicId] as const,
  procedures: (clinicId?: string) => ['procedures', clinicId] as const,
  appointments: (params?: string) => ['appointments', params] as const,
  leads: (params?: string) => ['leads', params] as const,
  leadStats: ['leads', 'stats'] as const,
  leadNotifications: ['leads', 'notifications'] as const,
  campaigns: (params?: string) => ['campaigns', params] as const,
  conversations: (params?: string) => ['conversations', params] as const,
  conversation: (id: string) => ['conversations', id] as const,
  analytics: (params?: string) => ['analytics', params] as const,
  waitlist: ['waitlist'] as const,
  settings: ['settings'] as const,
  patient: (id: string) => ['patients', id] as const,
  dentist: (id: string) => ['dentists', id] as const,
  procedure: (id: string) => ['procedures', id] as const,
  appointment: (id: string) => ['appointments', id] as const,
  lead: (id: string) => ['leads', id] as const,
  campaign: (id: string) => ['campaigns', id] as const,
  contacts: (params?: string) => ['contacts', params] as const,
  contact: (id: string, type: string) => ['contacts', id, type] as const,
  calendarEvents: (params?: string) => ['calendar-events', params] as const,
  customFieldDefinitions: (clinicId?: string) => ['custom-field-definitions', clinicId] as const,
  customFieldValues: (contactId: string, contactType: string) => ['custom-field-values', contactId, contactType] as const,
  consents: (contactId: string, contactType: string) => ['consents', contactId, contactType] as const,
  whatsappMessages: (contactId: string) => ['whatsapp-messages', contactId] as const,
  kanbanLeads: (clinicId: string) => ['kanban-leads', clinicId] as const,
  pipelineStages: (clinicId: string) => ['pipeline-stages', clinicId] as const,
}

/**
 * Generic fetcher with error handling
 */
async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  return response.json()
}

/**
 * Fetch kanban leads for pipeline
 */
export function fetchKanbanLeads(clinicId: string) {
  const supabase = createTypedClient()
  const { data, error } = supabase
    .from('leads')
    .select(`
      id, name, phone, email, source, temperature, score,
      stage_id, interest, last_contact_at, created_at, updated_at,
      pipeline_stages (id, name, color, sort_order)
    `)
    .eq('clinic_id', clinicId)
    .order('score', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Kanban leads query
 */
export function useKanbanLeads(clinicId: string) {
  return useQuery({
    queryKey: queryKeys.kanbanLeads(clinicId),
    queryFn: () => fetchKanbanLeads(clinicId),
    enabled: !!clinicId,
  })
}

/**
 * Fetch pipeline stages for kanban
 */
export function fetchPipelineStages(clinicId: string) {
  const supabase = createTypedClient()
  const { data, error } = supabase
    .from('pipeline_stages')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data ?? []
}

/**
 * Pipeline stages query
 */
export function usePipelineStages(clinicId: string) {
  return useQuery({
    queryKey: queryKeys.pipelineStages(clinicId),
    queryFn: () => fetchPipelineStages(clinicId),
    enabled: !!clinicId,
  })
}

/**
 * Dashboard stats — cached for 1 min
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: () => fetcher<any>('/api/dashboard/stats'),
  })
}

/**
 * Patients list — cached for 1 min, param-based
 */
export function usePatients(params?: Record<string, string>) {
  const qs = params ? new URLSearchParams(params).toString() : ''

  return useQuery({
    queryKey: queryKeys.patients(qs),
    queryFn: () => fetcher<any>(`/api/patients${qs ? `?${qs}` : ''}`),
    enabled: !!params,
  })
}

/**
 * Inactive patients — cached for 2 min
 */
export function useInactivePatients(minDays = 30) {
  return useQuery({
    queryKey: queryKeys.inactivePatients(`min_days=${minDays}`),
    queryFn: () => fetcher<any>(`/api/patients/inactive?min_days=${minDays}`),
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Inactive patients stats — cached for 2 min
 */
export function useInactiveStats() {
  return useQuery({
    queryKey: queryKeys.inactiveStats,
    queryFn: () => fetcher<any>('/api/patients/inactive?stats_only=true'),
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Dentists — cached for 5 min (rarely changes)
 */
export function useDentists(clinicId?: string) {
  return useQuery({
    queryKey: queryKeys.dentists(clinicId),
    queryFn: () => fetcher<any>(`/api/dentists${clinicId ? `?clinic_id=${clinicId}` : ''}`),
    staleTime: 5 * 60 * 1000,
    enabled: !!clinicId,
  })
}

/**
 * Procedures — cached for 5 min (rarely changes)
 */
export function useProcedures(clinicId?: string) {
  return useQuery({
    queryKey: queryKeys.procedures(clinicId),
    queryFn: () => fetcher<any>(`/api/procedures${clinicId ? `?clinic_id=${clinicId}` : ''}`),
    staleTime: 5 * 60 * 1000,
    enabled: !!clinicId,
  })
}

/**
 * Appointments — cached for 30s (changes frequently)
 */
export function useAppointments(params?: Record<string, string>) {
  const qs = params ? new URLSearchParams(params).toString() : ''

  return useQuery({
    queryKey: queryKeys.appointments(qs),
    queryFn: () => fetcher<any>(`/api/appointments${qs ? `?${qs}` : ''}`),
    staleTime: 30 * 1000,
    enabled: !!params,
  })
}

/**
 * Leads — cached for 1 min
 */
export function useLeads(params?: Record<string, string>) {
  const qs = params ? new URLSearchParams(params).toString() : ''

  return useQuery({
    queryKey: queryKeys.leads(qs),
    queryFn: () => fetcher<any>(`/api/leads${qs ? `?${qs}` : ''}`),
    enabled: params !== undefined,
  })
}

/**
 * Campaigns — cached for 1 min
 */
export function useCampaigns(params?: Record<string, string>) {
  const qs = params ? new URLSearchParams(params).toString() : ''

  return useQuery({
    queryKey: queryKeys.campaigns(qs),
    queryFn: () => fetcher<any>(`/api/campaigns${qs ? `?${qs}` : ''}`),
    enabled: !!params,
  })
}

/**
 * Conversations — cached for 30s
 */
export function useConversations(params?: Record<string, string>) {
  const qs = params ? new URLSearchParams(params).toString() : ''

  return useQuery({
    queryKey: queryKeys.conversations(qs),
    queryFn: () => fetcher<any>(`/api/conversations${qs ? `?${qs}` : ''}`),
    staleTime: 30 * 1000,
    enabled: !!params,
  })
}

/**
 * Lead stats — cached for 1 min
 */
export function useLeadStats() {
  return useQuery({
    queryKey: queryKeys.leadStats,
    queryFn: () => fetcher<any>('/api/leads/stats'),
  })
}

/**
 * Lead notifications — cached for 30s
 */
export function useLeadNotifications() {
  return useQuery({
    queryKey: queryKeys.leadNotifications,
    queryFn: () => fetcher<any>('/api/leads/notifications'),
    staleTime: 30 * 1000,
  })
}

/**
 * Single entity fetchers
 */
export function usePatient(id: string) {
  return useQuery({
    queryKey: queryKeys.patient(id),
    queryFn: () => fetcher<any>(`/api/patients/${id}`),
    enabled: !!id,
  })
}

export function useDentist(id: string) {
  return useQuery({
    queryKey: queryKeys.dentist(id),
    queryFn: () => fetcher<any>(`/api/dentists/${id}`),
    enabled: !!id,
  })
}

export function useProcedure(id: string) {
  return useQuery({
    queryKey: queryKeys.procedure(id),
    queryFn: () => fetcher<any>(`/api/procedures/${id}`),
    enabled: !!id,
  })
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: queryKeys.appointment(id),
    queryFn: () => fetcher<any>(`/api/appointments/${id}`),
    enabled: !!id,
  })
}

export function useLead(id: string) {
  return useQuery({
    queryKey: queryKeys.lead(id),
    queryFn: () => fetcher<any>(`/api/leads/${id}`),
    enabled: !!id,
  })
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: queryKeys.campaign(id),
    queryFn: () => fetcher<any>(`/api/campaigns/${id}`),
    enabled: !!id,
  })
}

/**
 * Calendar events — cached for 30s, enriched with joins
 */
export function useCalendarEventsQuery(params?: Record<string, string> | string) {
  const qs = typeof params === 'string' ? params : params ? new URLSearchParams(params).toString() : ''

  return useQuery({
    queryKey: queryKeys.calendarEvents(qs),
    queryFn: () => fetcher<any>(`/api/appointments${qs ? `?${qs}` : ''}`),
    staleTime: 30 * 1000,
    enabled: !!qs,
  })
}

/**
 * Single conversation with messages — cached for 30s
 */
export function useConversation(id: string) {
  return useQuery({
    queryKey: queryKeys.conversation(id),
    queryFn: () => fetcher<any>(`/api/conversations/${id}`),
    enabled: !!id,
    staleTime: 30 * 1000,
  })
}

/**
 * Waitlist — cached for 2 min
 */
export function useWaitlist() {
  return useQuery({
    queryKey: queryKeys.waitlist,
    queryFn: () => fetcher<any>('/api/waitlist'),
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Clinic settings — cached for 5 min
 */
export function useClinicSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => fetcher<any>('/api/clinics/settings'),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Contacts list — cached for 1 min
 */
export function useContacts(params?: Record<string, string>) {
  const qs = params ? new URLSearchParams(params).toString() : ''

  return useQuery({
    queryKey: queryKeys.contacts(qs),
    queryFn: () => fetcher<any>(`/api/contacts${qs ? `?${qs}` : ''}`),
    staleTime: 60 * 1000,
  })
}

/**
 * Single contact by ID and type
 */
export function useContact(id: string, type: string) {
  return useQuery({
    queryKey: queryKeys.contact(id, type),
    queryFn: () => fetcher<any>(`/api/contacts/${id}?type=${type}`),
    enabled: !!id && !!type,
    staleTime: 60 * 1000,
  })
}

/**
 * Contact notes
 */
export function useContactNotes(id: string, type: string) {
  return useQuery({
    queryKey: ['contacts', id, 'notes', type],
    queryFn: () => fetcher<any>(`/api/contacts/${id}/notes?type=${type}`),
    enabled: !!id && !!type,
    staleTime: 30 * 1000,
  })
}

/**
 * Custom field definitions — cached for 5 min
 */
export function useCustomFieldDefinitions(clinicId?: string) {
  return useQuery({
    queryKey: queryKeys.customFieldDefinitions(clinicId),
    queryFn: () => fetcher<any>(`/api/custom-fields/definitions${clinicId ? `?clinic_id=${clinicId}` : ''}`),
    staleTime: 5 * 60 * 1000,
    enabled: !!clinicId,
  })
}

/**
 * Custom field values for a contact — cached for 1 min
 */
export function useCustomFieldValues(contactId: string, contactType: 'patient' | 'lead') {
  return useQuery({
    queryKey: queryKeys.customFieldValues(contactId, contactType),
    queryFn: () => fetcher<any>(`/api/custom-fields/values?contact_id=${contactId}&contact_type=${contactType}`),
    staleTime: 60 * 1000,
    enabled: !!contactId && !!contactType,
  })
}

/**
 * Contact timeline — infinite query with cursor pagination
 */
export function useContactTimeline(id: string, type: 'patient' | 'lead', sourceFilter?: string) {
  return useInfiniteQuery({
    queryKey: ['contacts', id, 'timeline', type, sourceFilter],
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

/**
 * Contact consents
 */
export function useContactConsents(contactId: string, contactType: 'patient' | 'lead') {
  return useQuery({
    queryKey: queryKeys.consents(contactId, contactType),
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
      const res = await fetch('/api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Failed to grant consent')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.consents(variables.contact_id, variables.contact_type) })
    },
  })
}

/**
 * Revoke consent mutation
 */
export function useRevokeConsent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { contact_id: string; contact_type: 'patient' | 'lead'; purpose: string; channel?: string; notes?: string }) => {
      const res = await fetch('/api/consents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Failed to revoke consent')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.consents(variables.contact_id, variables.contact_type) })
    },
  })
}