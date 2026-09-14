/**
 * @jest-environment jsdom
 */

/**
 * Unit Test Suite for useTreatmentPlans hooks (src/hooks/useTreatmentPlans.ts)
 *
 * Covers:
 * 1. useTreatmentPlans: fetch list success, 500/error response, enabled condition (patientId vs null/empty)
 * 2. useTreatmentPlan: fetch single detail success, error response, enabled condition (id vs null/empty)
 * 3. useCreateTreatmentPlan: POST mutation payload, response mapping, query cache invalidations, error handling
 * 4. useUpdateTreatmentPlan: PATCH mutation payload, response mapping, query cache invalidations, error handling
 * 5. useUpdateSession: POST session mutation payload, response mapping, query cache invalidations, error handling
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useTreatmentPlans,
  useTreatmentPlan,
  useCreateTreatmentPlan,
  useUpdateTreatmentPlan,
  useUpdateSession,
} from '../useTreatmentPlans';

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

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, Wrapper };
}

describe('useTreatmentPlans Hook Suite', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('useTreatmentPlans', () => {
    it('fetches treatment plans list successfully for a given patientId', async () => {
      const mockPlans = [
        { id: 'tp-1', patient_id: 'pat-100', title: 'Ortodontia', status: 'em_andamento' },
        { id: 'tp-2', patient_id: 'pat-100', title: 'Clareamento', status: 'concluido' },
      ];

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { treatment_plans: mockPlans } }),
      } as Response);

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTreatmentPlans('pat-100'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(global.fetch).toHaveBeenCalledWith('/api/treatment-plans?patient_id=pat-100');
      expect(result.current.data).toEqual(mockPlans);
    });

    it('throws and sets error state when fetchTreatmentPlans fails', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTreatmentPlans('pat-100'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe('Failed to fetch treatment plans');
    });

    it('does not execute fetch when patientId is null or empty', () => {
      global.fetch = jest.fn();

      const { Wrapper } = createWrapper();
      const hookNull = renderHook(() => useTreatmentPlans(null), { wrapper: Wrapper });
      const hookEmpty = renderHook(() => useTreatmentPlans(''), { wrapper: Wrapper });

      expect(hookNull.result.current.fetchStatus).toBe('idle');
      expect(hookEmpty.result.current.fetchStatus).toBe('idle');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('useTreatmentPlan', () => {
    it('fetches single treatment plan detail successfully for a given id', async () => {
      const mockPlan = {
        id: 'tp-1',
        patient_id: 'pat-100',
        title: 'Implante Dentário',
        total_amount: 3500,
        status: 'aprovado',
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { treatment_plan: mockPlan } }),
      } as Response);

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTreatmentPlan('tp-1'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(global.fetch).toHaveBeenCalledWith('/api/treatment-plans/tp-1');
      expect(result.current.data).toEqual(mockPlan);
    });

    it('throws and sets error state when fetchTreatmentPlan fails', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTreatmentPlan('tp-999'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe('Failed to fetch treatment plan');
    });

    it('does not execute fetch when id is null or empty', () => {
      global.fetch = jest.fn();

      const { Wrapper } = createWrapper();
      const hookNull = renderHook(() => useTreatmentPlan(null), { wrapper: Wrapper });
      const hookEmpty = renderHook(() => useTreatmentPlan(''), { wrapper: Wrapper });

      expect(hookNull.result.current.fetchStatus).toBe('idle');
      expect(hookEmpty.result.current.fetchStatus).toBe('idle');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('useCreateTreatmentPlan', () => {
    it('creates treatment plan, returns created data, and invalidates query caches', async () => {
      const createdPlan = {
        id: 'tp-new-1',
        patient_id: 'pat-100',
        title: 'Prótese Fixa',
        status: 'rascunho',
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { treatment_plan: createdPlan } }),
      } as Response);

      const { Wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateTreatmentPlan(), { wrapper: Wrapper });

      const input = {
        patient_id: 'pat-100',
        title: 'Prótese Fixa',
        clinic_id: 'clinic-1',
      };

      result.current.mutate(input as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(global.fetch).toHaveBeenCalledWith('/api/treatment-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      expect(result.current.data).toEqual(createdPlan);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['treatment-plans', 'pat-100'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['treatment-plans', null] });
    });

    it('throws error when creation API request fails', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as Response);

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useCreateTreatmentPlan(), { wrapper: Wrapper });

      result.current.mutate({ patient_id: 'pat-100', title: 'Invalid' } as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('Failed to create treatment plan');
    });
  });

  describe('useUpdateTreatmentPlan', () => {
    it('updates treatment plan, returns updated data, and invalidates target caches', async () => {
      const updatedPlan = {
        id: 'tp-10',
        patient_id: 'pat-200',
        title: 'Canal Atualizado',
        status: 'em_andamento',
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { treatment_plan: updatedPlan } }),
      } as Response);

      const { Wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateTreatmentPlan(), { wrapper: Wrapper });

      const patchInput = { status: 'em_andamento' };
      result.current.mutate({ id: 'tp-10', input: patchInput as any });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(global.fetch).toHaveBeenCalledWith('/api/treatment-plans/tp-10', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchInput),
      });

      expect(result.current.data).toEqual(updatedPlan);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['treatment-plan', 'tp-10'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['treatment-plans', 'pat-200'] });
    });

    it('throws error when update API request fails', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTreatmentPlan(), { wrapper: Wrapper });

      result.current.mutate({ id: 'tp-10', input: { title: 'Fail' } as any });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('Failed to update treatment plan');
    });
  });

  describe('useUpdateSession', () => {
    it('posts session update, returns payload, and invalidates plan and plans caches', async () => {
      const sessionResult = { ok: true, session_id: 'sess-123' };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => sessionResult,
      } as Response);

      const { Wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateSession(), { wrapper: Wrapper });

      result.current.mutate({
        treatmentPlanId: 'tp-50',
        treatmentPlanItemId: 'item-88',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(global.fetch).toHaveBeenCalledWith('/api/treatment-plans/tp-50/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treatment_plan_item_id: 'item-88' }),
      });

      expect(result.current.data).toEqual(sessionResult);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['treatment-plan', 'tp-50'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['treatment-plans'] });
    });

    it('throws error when session update API request fails', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateSession(), { wrapper: Wrapper });

      result.current.mutate({
        treatmentPlanId: 'tp-50',
        treatmentPlanItemId: 'item-88',
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('Failed to update session');
    });
  });
});
