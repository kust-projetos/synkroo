/**
 * @jest-environment jsdom
 *
 * Comprehensive unit tests for src/lib/hooks/use-queries.ts
 * Covers:
 *  - queryKeys generation
 *  - fetcher (mock mode, mock fallback, fetch success, fetch error)
 *  - standalone fetchers: fetchKanbanLeads, fetchPipelineStages
 *  - query hooks: dashboard, patients, inactive patients, dentists, procedures,
 *    appointments, leads, campaigns, conversations, stats, settings, etc.
 *  - single entity hooks: usePatient, useDentist, useProcedure, useAppointment,
 *    useLead, useLeadsByPatient, useCampaign, useCalendarEventsQuery, useConversation,
 *    useWaitlist, useClinicSettings, useContacts, useContact, useContactNotes,
 *    useCustomFieldDefinitions, useCustomFieldValues, useContactConsents, useDuplicateSuggestions,
 *    useContactDuplicateSuggestion
 *  - financeiro hooks: useBudgets, usePayments, useCollections, useGateways, useFinanceDashboard
 *  - task hooks: useTasks with various filter combinations
 *  - infinite queries: useContactTimeline, useAllActivities
 *  - mutations: useUpdateBudgetStatus, useCreateTask, useUpdateTask, useDeleteTask,
 *    useGrantConsent, useRevokeConsent, useApproveSuggestion, useDismissSuggestion, useMergeSuggestion,
 *    useAddContactNote, useUpdateContactTags
 *  - error branches and edge cases
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  queryKeys,
  duplicateKeys,
  fetchKanbanLeads,
  fetchPipelineStages,
  useKanbanLeads,
  usePipelineStages,
  useDashboardStats,
  usePatients,
  useInactivePatients,
  useInactiveStats,
  useDentists,
  useProcedures,
  useAppointments,
  useLeads,
  useCampaigns,
  useConversations,
  useLeadStats,
  useCrmStats,
  useLeadNotifications,
  usePatient,
  useDentist,
  useProcedure,
  useAppointment,
  useLead,
  useLeadsByPatient,
  useCampaign,
  useCalendarEventsQuery,
  useConversation,
  useWaitlist,
  useClinicSettings,
  useContacts,
  useContact,
  useContactNotes,
  useCustomFieldDefinitions,
  useCustomFieldValues,
  useContactTimeline,
  useBudgets,
  usePayments,
  useCollections,
  useGateways,
  useFinanceDashboard,
  useUpdateBudgetStatus,
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useAllActivities,
  useContactConsents,
  useGrantConsent,
  useRevokeConsent,
  useDuplicateSuggestions,
  useContactDuplicateSuggestion,
  useApproveSuggestion,
  useDismissSuggestion,
  useMergeSuggestion,
  useAddContactNote,
  useUpdateContactTags,
} from '@/lib/hooks/use-queries';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('queryKeys factory functions', () => {
  it('generates correct query keys for all domain keys', () => {
    expect(queryKeys.dashboardStats).toEqual(['dashboard', 'stats']);
    expect(queryKeys.patients()).toEqual(['patients', undefined]);
    expect(queryKeys.patients('page=1')).toEqual(['patients', 'page=1']);
    expect(queryKeys.inactivePatients()).toEqual(['patients', 'inactive', undefined]);
    expect(queryKeys.inactivePatients('min_days=30')).toEqual(['patients', 'inactive', 'min_days=30']);
    expect(queryKeys.inactiveStats).toEqual(['patients', 'inactive', 'stats']);
    expect(queryKeys.dentists()).toEqual(['dentists', undefined]);
    expect(queryKeys.dentists('clinic-1')).toEqual(['dentists', 'clinic-1']);
    expect(queryKeys.procedures()).toEqual(['procedures', undefined]);
    expect(queryKeys.procedures('clinic-1')).toEqual(['procedures', 'clinic-1']);
    expect(queryKeys.appointments()).toEqual(['appointments', undefined]);
    expect(queryKeys.appointments('status=scheduled')).toEqual(['appointments', 'status=scheduled']);
    expect(queryKeys.leads()).toEqual(['leads', undefined]);
    expect(queryKeys.leads('status=new')).toEqual(['leads', 'status=new']);
    expect(queryKeys.leadStats).toEqual(['leads', 'stats']);
    expect(queryKeys.leadNotifications).toEqual(['leads', 'notifications']);
    expect(queryKeys.crmStats).toEqual(['crm', 'stats']);
    expect(queryKeys.campaigns()).toEqual(['campaigns', undefined]);
    expect(queryKeys.campaigns('page=1')).toEqual(['campaigns', 'page=1']);
    expect(queryKeys.conversations()).toEqual(['conversations', undefined]);
    expect(queryKeys.conversations('limit=10')).toEqual(['conversations', 'limit=10']);
    expect(queryKeys.conversation('conv-1')).toEqual(['conversations', 'conv-1']);
    expect(queryKeys.analytics()).toEqual(['analytics', undefined]);
    expect(queryKeys.analytics('period=30d')).toEqual(['analytics', 'period=30d']);
    expect(queryKeys.waitlist).toEqual(['waitlist']);
    expect(queryKeys.settings).toEqual(['settings']);
    expect(queryKeys.patient('p-1')).toEqual(['patients', 'p-1']);
    expect(queryKeys.dentist('d-1')).toEqual(['dentists', 'd-1']);
    expect(queryKeys.procedure('pr-1')).toEqual(['procedures', 'pr-1']);
    expect(queryKeys.appointment('app-1')).toEqual(['appointments', 'app-1']);
    expect(queryKeys.lead('l-1')).toEqual(['leads', 'l-1']);
    expect(queryKeys.campaign('c-1')).toEqual(['campaigns', 'c-1']);
    expect(queryKeys.contacts()).toEqual(['contacts', undefined]);
    expect(queryKeys.contacts('page=1')).toEqual(['contacts', 'page=1']);
    expect(queryKeys.contact('c-1', 'patient')).toEqual(['contacts', 'c-1', 'patient']);
    expect(queryKeys.calendarEvents()).toEqual(['calendar-events', undefined]);
    expect(queryKeys.calendarEvents('month=2026-08')).toEqual(['calendar-events', 'month=2026-08']);
    expect(queryKeys.customFieldDefinitions()).toEqual(['custom-field-definitions', undefined]);
    expect(queryKeys.customFieldDefinitions('clinic-1')).toEqual(['custom-field-definitions', 'clinic-1']);
    expect(queryKeys.customFieldValues('c-1', 'patient')).toEqual(['custom-field-values', 'c-1', 'patient']);
    expect(queryKeys.consents('c-1', 'lead')).toEqual(['consents', 'c-1', 'lead']);
    expect(queryKeys.whatsappMessages('c-1')).toEqual(['whatsapp-messages', 'c-1']);
    expect(queryKeys.kanbanLeads('clinic-1')).toEqual(['kanban-leads', 'clinic-1']);
    expect(queryKeys.pipelineStages('clinic-1')).toEqual(['pipeline-stages', 'clinic-1']);
    expect(duplicateKeys.all).toEqual(['duplicates']);
    expect(duplicateKeys.list('param-1')).toEqual(['duplicates', 'list', 'param-1']);
  });
});

describe('fetcher behavior via queries', () => {
  const originalEnv = process.env.NEXT_PUBLIC_USE_MOCKS;

  beforeEach(() => {
    (global.fetch as unknown) = jest.fn();
    delete process.env.NEXT_PUBLIC_USE_MOCKS;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_USE_MOCKS = originalEnv;
    jest.restoreAllMocks();
  });

  it('handles fetcher success when mock mode is off', async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'false';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stats: { total: 10 } }),
    });

    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ stats: { total: 10 } });
    expect(global.fetch).toHaveBeenCalledWith('/api/dashboard/stats');
  });

  it('handles fetcher error when response is not ok', async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'false';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('API error: 500');
  });

  it('handles fetcher in mock mode with fixture match', async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'true';

    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('handles fetcher in mock mode falling back to real fetch when no fixture exists', async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'true';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ budgets: [{ id: 'b1' }] }),
    });

    const { result } = renderHook(() => useBudgets(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ budgets: [{ id: 'b1' }] });
    expect(global.fetch).toHaveBeenCalledWith('/api/financeiro/budgets');
  });
});

describe('fetchKanbanLeads & fetchPipelineStages standalone fetchers', () => {
  beforeEach(() => {
    (global.fetch as unknown) = jest.fn();
    delete process.env.NEXT_PUBLIC_USE_MOCKS;
  });

  it('fetchKanbanLeads returns leads array and falls back to empty array when leads is undefined', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leads: [{ id: 'lead-1', name: 'Lead 1' }] }),
    });

    const leads = await fetchKanbanLeads('clinic-123');
    expect(leads).toEqual([{ id: 'lead-1', name: 'Lead 1' }]);
    expect(global.fetch).toHaveBeenCalledWith('/api/leads/kanban?clinic_id=clinic-123');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    const emptyLeads = await fetchKanbanLeads('clinic-123');
    expect(emptyLeads).toEqual([]);
  });

  it('fetchPipelineStages returns stages array and falls back to empty array when stages is undefined', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stages: [{ id: 'stage-1', name: 'Stage 1' }] }),
    });

    const stages = await fetchPipelineStages('clinic-123');
    expect(stages).toEqual([{ id: 'stage-1', name: 'Stage 1' }]);
    expect(global.fetch).toHaveBeenCalledWith('/api/pipeline/stages?clinic_id=clinic-123');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    const emptyStages = await fetchPipelineStages('clinic-123');
    expect(emptyStages).toEqual([]);
  });
});

describe('Domain Query Hooks', () => {
  beforeEach(() => {
    (global.fetch as unknown) = jest.fn();
    delete process.env.NEXT_PUBLIC_USE_MOCKS;
  });

  it('useKanbanLeads fetches when clinicId is present and skips when falsy', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leads: [{ id: 'l1' }] }),
    });

    const { result: enabledResult } = renderHook(() => useKanbanLeads('clinic-1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(enabledResult.current.isSuccess).toBe(true));
    expect(enabledResult.current.data).toEqual([{ id: 'l1' }]);

    const { result: disabledResult } = renderHook(() => useKanbanLeads(''), {
      wrapper: createWrapper(),
    });
    expect(disabledResult.current.fetchStatus).toBe('idle');
  });

  it('usePipelineStages fetches when clinicId is present and skips when falsy', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stages: [{ id: 's1' }] }),
    });

    const { result: enabledResult } = renderHook(() => usePipelineStages('clinic-1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(enabledResult.current.isSuccess).toBe(true));
    expect(enabledResult.current.data).toEqual([{ id: 's1' }]);

    const { result: disabledResult } = renderHook(() => usePipelineStages(''), {
      wrapper: createWrapper(),
    });
    expect(disabledResult.current.fetchStatus).toBe('idle');
  });

  it('usePatients formats query params and handles empty params object and undefined params', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ patients: [{ id: 'p1' }] }),
    });

    const { result: enabledResult } = renderHook(
      () => usePatients({ page: '1', search: 'Ana' }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(enabledResult.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/patients?page=1&search=Ana');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ patients: [] }),
    });
    const { result: emptyParamsResult } = renderHook(() => usePatients({}), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(emptyParamsResult.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/patients');

    const { result: disabledResult } = renderHook(() => usePatients(undefined), {
      wrapper: createWrapper(),
    });
    expect(disabledResult.current.fetchStatus).toBe('idle');
  });

  it('useInactivePatients respects default minDays and custom minDays', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ patients: [] }),
    });

    const { result: defaultResult } = renderHook(() => useInactivePatients(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(defaultResult.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/patients/inactive?min_days=30');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ patients: [] }),
    });
    const { result: customResult } = renderHook(() => useInactivePatients(90), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(customResult.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/patients/inactive?min_days=90');
  });

  it('useInactiveStats calls inactive stats endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ totalInactive: 15 }),
    });

    const { result } = renderHook(() => useInactiveStats(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/patients/inactive?stats_only=true');
  });

  it('useDentists formats clinic_id param and enables correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ dentists: [] }),
    });

    const { result } = renderHook(() => useDentists('c-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/dentists?clinic_id=c-1');

    const { result: disabled } = renderHook(() => useDentists(undefined), {
      wrapper: createWrapper(),
    });
    expect(disabled.current.fetchStatus).toBe('idle');
  });

  it('useProcedures formats clinic_id param and enables correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ procedures: [] }),
    });

    const { result } = renderHook(() => useProcedures('c-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/procedures?clinic_id=c-1');

    const { result: disabled } = renderHook(() => useProcedures(undefined), {
      wrapper: createWrapper(),
    });
    expect(disabled.current.fetchStatus).toBe('idle');
  });

  it('useAppointments formats query params and handles empty params object', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ appointments: [] }),
    });

    const { result } = renderHook(() => useAppointments({ status: 'confirmed' }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/appointments?status=confirmed');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ appointments: [] }),
    });
    const { result: emptyParams } = renderHook(() => useAppointments({}), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(emptyParams.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/appointments');

    const { result: disabled } = renderHook(() => useAppointments(undefined), {
      wrapper: createWrapper(),
    });
    expect(disabled.current.fetchStatus).toBe('idle');
  });

  it('useLeads formats query params and handles empty params object', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leads: [] }),
    });

    const { result: withParams } = renderHook(() => useLeads({ status: 'new' }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(withParams.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/leads?status=new');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leads: [] }),
    });
    const { result: emptyParams } = renderHook(() => useLeads({}), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(emptyParams.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/leads');

    const { result: disabled } = renderHook(() => useLeads(undefined), {
      wrapper: createWrapper(),
    });
    expect(disabled.current.fetchStatus).toBe('idle');
  });

  it('useCampaigns formats query params and handles empty params object', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: [] }),
    });

    const { result } = renderHook(() => useCampaigns({ page: '2' }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/campaigns?page=2');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: [] }),
    });
    const { result: emptyParams } = renderHook(() => useCampaigns({}), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(emptyParams.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/campaigns');

    const { result: disabled } = renderHook(() => useCampaigns(undefined), {
      wrapper: createWrapper(),
    });
    expect(disabled.current.fetchStatus).toBe('idle');
  });

  it('useConversations formats query params and handles empty params object', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ conversations: [] }),
    });

    const { result } = renderHook(() => useConversations({ status: 'open' }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/conversations?status=open');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ conversations: [] }),
    });
    const { result: emptyParams } = renderHook(() => useConversations({}), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(emptyParams.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/conversations');

    const { result: disabled } = renderHook(() => useConversations(undefined), {
      wrapper: createWrapper(),
    });
    expect(disabled.current.fetchStatus).toBe('idle');
  });

  it('useLeadStats, useCrmStats, useLeadNotifications call their respective endpoints', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total: 100 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ active: 50 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notifications: [] }) });

    const { result: statsRes } = renderHook(() => useLeadStats(), { wrapper: createWrapper() });
    await waitFor(() => expect(statsRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/leads/stats');

    const { result: crmRes } = renderHook(() => useCrmStats(), { wrapper: createWrapper() });
    await waitFor(() => expect(crmRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/crm/stats');

    const { result: notifRes } = renderHook(() => useLeadNotifications(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(notifRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/leads/notifications');
  });
});

describe('Single Entity Query Hooks', () => {
  beforeEach(() => {
    (global.fetch as unknown) = jest.fn();
    delete process.env.NEXT_PUBLIC_USE_MOCKS;
  });

  it('usePatient, useDentist, useProcedure, useAppointment, useLead, useCampaign, useConversation', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'p1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'd1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'pr1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'a1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'l1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'c1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'conv1' }) });

    const { result: pRes } = renderHook(() => usePatient('p1'), { wrapper: createWrapper() });
    await waitFor(() => expect(pRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/patients/p1');

    const { result: dRes } = renderHook(() => useDentist('d1'), { wrapper: createWrapper() });
    await waitFor(() => expect(dRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/dentists/d1');

    const { result: prRes } = renderHook(() => useProcedure('pr1'), { wrapper: createWrapper() });
    await waitFor(() => expect(prRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/procedures/pr1');

    const { result: aRes } = renderHook(() => useAppointment('a1'), { wrapper: createWrapper() });
    await waitFor(() => expect(aRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/appointments/a1');

    const { result: lRes } = renderHook(() => useLead('l1'), { wrapper: createWrapper() });
    await waitFor(() => expect(lRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/leads/l1');

    const { result: cRes } = renderHook(() => useCampaign('c1'), { wrapper: createWrapper() });
    await waitFor(() => expect(cRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/campaigns/c1');

    const { result: convRes } = renderHook(() => useConversation('conv1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(convRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/conversations/conv1');
  });

  it('useLeadsByPatient handles valid patientId and null patientId', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leads: [] }),
    });

    const { result: enabled } = renderHook(() => useLeadsByPatient('pat-123'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(enabled.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/leads?patient_id=pat-123');

    const { result: disabled } = renderHook(() => useLeadsByPatient(null), {
      wrapper: createWrapper(),
    });
    expect(disabled.current.fetchStatus).toBe('idle');
  });

  it('useCalendarEventsQuery handles string params, object params, and empty/undefined params', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [] }),
    });

    const { result: stringParams } = renderHook(
      () => useCalendarEventsQuery('start=2026-08-01&end=2026-08-31'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(stringParams.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/appointments?start=2026-08-01&end=2026-08-31');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [] }),
    });
    const { result: objectParams } = renderHook(
      () => useCalendarEventsQuery({ start: '2026-08-01' }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(objectParams.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/appointments?start=2026-08-01');

    const { result: undefinedParams } = renderHook(() => useCalendarEventsQuery(undefined), {
      wrapper: createWrapper(),
    });
    expect(undefinedParams.current.fetchStatus).toBe('idle');
  });

  it('useWaitlist, useClinicSettings, useContacts, useContact, useContactNotes', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ waitlist: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ settings: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ contacts: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ contacts: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'c1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notes: [] }) });

    const { result: wlRes } = renderHook(() => useWaitlist(), { wrapper: createWrapper() });
    await waitFor(() => expect(wlRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/waitlist');

    const { result: setRes } = renderHook(() => useClinicSettings(), { wrapper: createWrapper() });
    await waitFor(() => expect(setRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/clinics/settings');

    const { result: cntsRes } = renderHook(() => useContacts({ page: '1' }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(cntsRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/contacts?page=1');

    const { result: cntsNoParamsRes } = renderHook(() => useContacts(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(cntsNoParamsRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/contacts');

    const { result: cntRes } = renderHook(() => useContact('c1', 'patient'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(cntRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/contacts/c1?type=patient');

    const { result: notesRes } = renderHook(() => useContactNotes('c1', 'lead'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(notesRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/contacts/c1/notes?type=lead');
  });

  it('useCustomFieldDefinitions, useCustomFieldValues, useContactConsents', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ definitions: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ values: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ consents: [] }) });

    const { result: defRes } = renderHook(() => useCustomFieldDefinitions('clinic-1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(defRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/custom-fields/definitions?clinic_id=clinic-1');

    const { result: valRes } = renderHook(() => useCustomFieldValues('c1', 'patient'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(valRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/custom-fields/values?contact_id=c1&contact_type=patient',
    );

    const { result: consRes } = renderHook(() => useContactConsents('c1', 'lead'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(consRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/consents?contact_id=c1&contact_type=lead');
  });
});

describe('Infinite Query Hooks: useContactTimeline & useAllActivities', () => {
  beforeEach(() => {
    (global.fetch as unknown) = jest.fn();
    delete process.env.NEXT_PUBLIC_USE_MOCKS;
  });

  it('useContactTimeline handles queryFn with cursor, sourceFilter, and next_cursor pagination unwrap', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: 'act-1' }],
        next_cursor: 'cursor-page-2',
      }),
    });

    const { result } = renderHook(() => useContactTimeline('c1', 'patient', 'whatsapp'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/contacts/c1/timeline?type=patient&source=whatsapp',
    );
    expect(result.current.hasNextPage).toBe(true);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: 'act-2' }],
        next_cursor: null,
      }),
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/contacts/c1/timeline?type=patient&cursor=cursor-page-2&source=whatsapp',
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it('useContactTimeline throws error when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useContactTimeline('c1', 'patient'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Failed to fetch timeline');
  });

  it('useAllActivities handles options filters, cursor pagination, and error throw', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: 'act-1' }],
        next_cursor: 'cursor-10',
      }),
    });

    const { result } = renderHook(
      () =>
        useAllActivities({
          sourceFilter: 'sms',
          contactId: 'c1',
          startDate: '2026-08-01',
          endDate: '2026-08-22',
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/activities?source=sms&contact_id=c1&start_date=2026-08-01&end_date=2026-08-22',
    );
    expect(result.current.hasNextPage).toBe(true);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: 'act-2' }],
        next_cursor: null,
      }),
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/activities?cursor=cursor-10&source=sms&contact_id=c1&start_date=2026-08-01&end_date=2026-08-22',
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
    });

    const { result: errorResult } = renderHook(() => useAllActivities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(errorResult.current.isError).toBe(true));
    expect(errorResult.current.error?.message).toBe('Failed to fetch activities');
  });
});

describe('Financeiro Hooks', () => {
  beforeEach(() => {
    (global.fetch as unknown) = jest.fn();
    delete process.env.NEXT_PUBLIC_USE_MOCKS;
  });

  it('useBudgets, usePayments, useCollections, useGateways, useFinanceDashboard', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ budgets: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ payments: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ collections: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ gateways: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ metrics: {}, charges: [] }) });

    const { result: bRes } = renderHook(() => useBudgets(), { wrapper: createWrapper() });
    await waitFor(() => expect(bRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/financeiro/budgets');

    const { result: pRes } = renderHook(() => usePayments('b-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(pRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/financeiro/budgets/b-1/payments');

    const { result: disabledPay } = renderHook(() => usePayments(null), {
      wrapper: createWrapper(),
    });
    expect(disabledPay.current.fetchStatus).toBe('idle');

    const { result: cRes } = renderHook(() => useCollections(), { wrapper: createWrapper() });
    await waitFor(() => expect(cRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/financeiro/collections');

    const { result: gRes } = renderHook(() => useGateways(), { wrapper: createWrapper() });
    await waitFor(() => expect(gRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/financeiro/gateways');

    const { result: dRes } = renderHook(() => useFinanceDashboard(), { wrapper: createWrapper() });
    await waitFor(() => expect(dRes.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/financeiro/dashboard');
  });

  it('useUpdateBudgetStatus updates status on success and throws on error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useUpdateBudgetStatus(), { wrapper: createWrapper() });

    await act(async () => {
      const res = await result.current.mutateAsync({ id: 'b-1', status: 'approved' });
      expect(res).toEqual({ success: true });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/financeiro/budgets/b-1/status',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      }),
    );

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'b-1', status: 'rejected' }),
      ).rejects.toThrow('Failed to update budget status');
    });
  });
});

describe('Tasks Hooks & Mutations (Mock vs Real)', () => {
  const originalEnv = process.env.NEXT_PUBLIC_USE_MOCKS;

  beforeEach(() => {
    (global.fetch as unknown) = jest.fn();
    delete process.env.NEXT_PUBLIC_USE_MOCKS;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_USE_MOCKS = originalEnv;
    jest.restoreAllMocks();
  });

  it('useTasks formats all filter options (status, priority, lead_id, all values)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tasks: [] }),
    });

    const { result } = renderHook(
      () =>
        useTasks({
          status: 'pending',
          priority: 'high',
          lead_id: 'lead-123',
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/tasks?status=pending&priority=high&lead_id=lead-123',
    );

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tasks: [] }),
    });
    const { result: allFiltersResult } = renderHook(
      () =>
        useTasks({
          status: 'all',
          priority: 'all',
        }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(allFiltersResult.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/tasks?');
  });

  it('useCreateTask handles mock mode and real mode (success + failure)', async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'true';
    const { result: mockResult } = renderHook(() => useCreateTask(), { wrapper: createWrapper() });

    await act(async () => {
      const res = await mockResult.current.mutateAsync({
        title: 'Mock Task',
        priority: 'high',
      });
      expect(res.id).toContain('mock-task-new-');
      expect(res.title).toBe('Mock Task');
    });
    expect(global.fetch).not.toHaveBeenCalled();

    delete process.env.NEXT_PUBLIC_USE_MOCKS;
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'real-task-1', title: 'Real Task' }),
    });

    const { result: realResult } = renderHook(() => useCreateTask(), { wrapper: createWrapper() });
    await act(async () => {
      const res = await realResult.current.mutateAsync({ title: 'Real Task' });
      expect(res.id).toBe('real-task-1');
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Real Task' }),
      }),
    );

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    await act(async () => {
      await expect(realResult.current.mutateAsync({ title: 'Fail Task' })).rejects.toThrow(
        'Failed to create task',
      );
    });
  });

  it('useUpdateTask handles mock mode and real mode (success + failure)', async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'true';
    const { result: mockResult } = renderHook(() => useUpdateTask(), { wrapper: createWrapper() });

    await act(async () => {
      const res = await mockResult.current.mutateAsync({
        id: 'task-1',
        status: 'completed',
      });
      expect(res.success).toBe(true);
      expect(res.id).toBe('task-1');
    });
    expect(global.fetch).not.toHaveBeenCalled();

    delete process.env.NEXT_PUBLIC_USE_MOCKS;
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, id: 'task-1' }),
    });

    const { result: realResult } = renderHook(() => useUpdateTask(), { wrapper: createWrapper() });
    await act(async () => {
      const res = await realResult.current.mutateAsync({ id: 'task-1', status: 'completed' });
      expect(res.success).toBe(true);
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'task-1', status: 'completed' }),
      }),
    );

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    await act(async () => {
      await expect(
        realResult.current.mutateAsync({ id: 'task-1', status: 'cancelled' }),
      ).rejects.toThrow('Failed to update task');
    });
  });

  it('useDeleteTask handles mock mode and real mode (success + failure)', async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'true';
    const { result: mockResult } = renderHook(() => useDeleteTask(), { wrapper: createWrapper() });

    await act(async () => {
      const res = await mockResult.current.mutateAsync('task-1');
      expect(res.success).toBe(true);
      expect(res.id).toBe('task-1');
    });
    expect(global.fetch).not.toHaveBeenCalled();

    delete process.env.NEXT_PUBLIC_USE_MOCKS;
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, id: 'task-1' }),
    });

    const { result: realResult } = renderHook(() => useDeleteTask(), { wrapper: createWrapper() });
    await act(async () => {
      const res = await realResult.current.mutateAsync('task-1');
      expect(res.success).toBe(true);
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/tasks?id=task-1',
      expect.objectContaining({ method: 'DELETE' }),
    );

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    await act(async () => {
      await expect(realResult.current.mutateAsync('task-fail')).rejects.toThrow(
        'Failed to delete task',
      );
    });
  });
});

describe('Consent Mutations: useGrantConsent & useRevokeConsent', () => {
  const originalEnv = process.env.NEXT_PUBLIC_USE_MOCKS;

  beforeEach(() => {
    (global.fetch as unknown) = jest.fn();
    delete process.env.NEXT_PUBLIC_USE_MOCKS;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_USE_MOCKS = originalEnv;
    jest.restoreAllMocks();
  });

  it('useGrantConsent handles mock mode and real mode (success + failure)', async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'true';
    const { result: mockResult } = renderHook(() => useGrantConsent(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const res = await mockResult.current.mutateAsync({
        contact_id: 'c1',
        contact_type: 'patient',
        purpose: 'marketing',
      });
      expect(res.granted).toBe(true);
      expect(res.contact_id).toBe('c1');
    });

    delete process.env.NEXT_PUBLIC_USE_MOCKS;
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'consent-1' }),
    });

    const { result: realResult } = renderHook(() => useGrantConsent(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      const res = await realResult.current.mutateAsync({
        contact_id: 'c1',
        contact_type: 'patient',
        purpose: 'marketing',
      });
      expect(res.id).toBe('consent-1');
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    await act(async () => {
      await expect(
        realResult.current.mutateAsync({
          contact_id: 'c1',
          contact_type: 'patient',
          purpose: 'marketing',
        }),
      ).rejects.toThrow('Failed to grant consent');
    });
  });

  it('useRevokeConsent handles mock mode and real mode (success + failure)', async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'true';
    const { result: mockResult } = renderHook(() => useRevokeConsent(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const res = await mockResult.current.mutateAsync({
        contact_id: 'c1',
        contact_type: 'lead',
        purpose: 'marketing',
      });
      expect(res.success).toBe(true);
      expect(res.contact_id).toBe('c1');
    });

    delete process.env.NEXT_PUBLIC_USE_MOCKS;
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result: realResult } = renderHook(() => useRevokeConsent(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      const res = await realResult.current.mutateAsync({
        contact_id: 'c1',
        contact_type: 'lead',
        purpose: 'marketing',
      });
      expect(res.success).toBe(true);
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    await act(async () => {
      await expect(
        realResult.current.mutateAsync({
          contact_id: 'c1',
          contact_type: 'lead',
          purpose: 'marketing',
        }),
      ).rejects.toThrow('Failed to revoke consent');
    });
  });
});

describe('Duplicate suggestions query, hooks & mutations', () => {
  beforeEach(() => {
    (global.fetch as unknown) = jest.fn();
    delete process.env.NEXT_PUBLIC_USE_MOCKS;
  });

  it('useDuplicateSuggestions handles params and error response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ suggestions: [] }),
    });

    const { result } = renderHook(
      () => useDuplicateSuggestions({ status: 'pending', ownerType: 'patient' }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/contacts/duplicates?status=pending&owner_type=patient',
    );

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    const { result: errorResult } = renderHook(() => useDuplicateSuggestions(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(errorResult.current.isError).toBe(true));
    expect(errorResult.current.error?.message).toBe('Failed to fetch duplicates');
  });

  it('useContactDuplicateSuggestion finds leftId, rightId, wrapped data, and empty fallback', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 'dup-1', leftId: 'cont-1', rightId: 'cont-2' },
        { id: 'dup-2', leftId: 'cont-3', rightId: 'cont-4' },
      ],
    });

    const { result: leftMatch } = renderHook(
      () => useContactDuplicateSuggestion('cont-1', 'patient'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(leftMatch.current.selected?.id).toBe('dup-1'));

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'dup-right', leftId: 'cont-x', rightId: 'cont-target' }],
      }),
    });

    const { result: rightMatch } = renderHook(
      () => useContactDuplicateSuggestion('cont-target', 'lead'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(rightMatch.current.selected?.id).toBe('dup-right'));

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ notAnArray: true }),
    });

    const { result: fallbackMatch } = renderHook(
      () => useContactDuplicateSuggestion('cont-none', 'patient'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(fallbackMatch.current.isLoading).toBe(false));
    expect(fallbackMatch.current.selected).toBeUndefined();
  });

  it('useApproveSuggestion, useDismissSuggestion, useMergeSuggestion handle success and error', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ approved: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ dismissed: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ merged: true }) });

    const { result: appResult } = renderHook(() => useApproveSuggestion(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await appResult.current.mutateAsync('dup-1');
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/contacts/duplicates/dup-1/approve',
      expect.objectContaining({ method: 'POST' }),
    );

    const { result: disResult } = renderHook(() => useDismissSuggestion(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await disResult.current.mutateAsync({ id: 'dup-1', reason: 'Not a duplicate' });
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/contacts/duplicates/dup-1/dismiss',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss_reason: 'Not a duplicate' }),
      }),
    );

    const { result: mrgResult } = renderHook(() => useMergeSuggestion(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await mrgResult.current.mutateAsync('dup-1');
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/contacts/duplicates/dup-1/merge',
      expect.objectContaining({ method: 'POST' }),
    );

    // Errors
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    await act(async () => {
      await expect(appResult.current.mutateAsync('dup-err')).rejects.toThrow('Failed to approve');
      await expect(
        disResult.current.mutateAsync({ id: 'dup-err', reason: 'foo' }),
      ).rejects.toThrow('Failed to dismiss');
      await expect(mrgResult.current.mutateAsync('dup-err')).rejects.toThrow('Failed to merge');
    });
  });

  it('useAddContactNote & useUpdateContactTags handle success and error when response is not ok', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'n1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    const { result: addNote } = renderHook(() => useAddContactNote(), {
      wrapper: createWrapper(),
    });
    const { result: updateTags } = renderHook(() => useUpdateContactTags(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const res = await addNote.current.mutateAsync({
        type: 'patient',
        id: 'p1',
        content: 'note content',
      });
      expect(res).toEqual({ id: 'n1' });
    });

    await act(async () => {
      const res = await updateTags.current.mutateAsync({
        type: 'lead',
        id: 'l1',
        tags: ['VIP'],
      });
      expect(res).toEqual({ success: true });
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    await act(async () => {
      await expect(
        addNote.current.mutateAsync({ type: 'patient', id: 'p1', content: 'note' }),
      ).rejects.toThrow('Failed to add note: 500');
      await expect(
        updateTags.current.mutateAsync({ type: 'lead', id: 'l1', tags: ['a'] }),
      ).rejects.toThrow('Failed to update tags: 500');
    });
  });
});
