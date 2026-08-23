/**
 * @jest-environment jsdom
 */

/**
 * Unit Test Suite for use-kanban hook (src/hooks/use-kanban.ts)
 *
 * Covers:
 * 1. Guards: null destination, same position (droppableId & index match)
 * 2. Version extraction: updated_at presence, missing lead, non-array or null cache
 * 3. Optimistic cache update: array mapping, null/undefined old data, non-array old data
 * 4. Server PATCH: payload, headers, successful 200 response, query invalidation
 * 5. 409 Conflict: cache invalidation and onError(err, true) callback
 * 6. Non-OK errors (500) & network failure: cache invalidation and onError(err, false) callback
 * 7. Optional onError callback handling
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DropResult } from '@hello-pangea/dnd';
import { useKanbanBoard } from '../use-kanban';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
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

describe('useKanbanBoard Hook Suite', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Early return guards', () => {
    it('returns early when destination is null/undefined', async () => {
      const { Wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useKanbanBoard(), { wrapper: Wrapper });

      const dropResult: DropResult = {
        draggableId: 'lead-1',
        type: 'DEFAULT',
        source: { droppableId: 'stage-1', index: 0 },
        destination: null,
        reason: 'CANCEL',
        mode: 'FLUID',
      };

      await act(async () => {
        await result.current.onDragEnd(dropResult);
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('returns early when destination has same droppableId and same index', async () => {
      const { Wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useKanbanBoard(), { wrapper: Wrapper });

      const dropResult: DropResult = {
        draggableId: 'lead-1',
        type: 'DEFAULT',
        source: { droppableId: 'stage-1', index: 2 },
        destination: { droppableId: 'stage-1', index: 2 },
        reason: 'DROP',
        mode: 'FLUID',
      };

      await act(async () => {
        await result.current.onDragEnd(dropResult);
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('proceeds when droppableId is the same but index is different (reorder)', async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useKanbanBoard(), { wrapper: Wrapper });

      const dropResult: DropResult = {
        draggableId: 'lead-1',
        type: 'DEFAULT',
        source: { droppableId: 'stage-1', index: 0 },
        destination: { droppableId: 'stage-1', index: 3 },
        reason: 'DROP',
        mode: 'FLUID',
      };

      await act(async () => {
        await result.current.onDragEnd(dropResult);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Version extraction & optimistic update branches', () => {
    it('extracts updated_at as leadVersion and updates matching lead in cache', async () => {
      const initialLeads = [
        { id: 'lead-1', stage_id: 'stage-1', updated_at: '2026-08-20T12:00:00Z', name: 'Lead 1' },
        { id: 'lead-2', stage_id: 'stage-1', updated_at: '2026-08-20T13:00:00Z', name: 'Lead 2' },
      ];

      const { Wrapper, queryClient } = createWrapper();
      queryClient.setQueryData(['kanban-leads'], initialLeads);

      const { result } = renderHook(() => useKanbanBoard(), { wrapper: Wrapper });

      const dropResult: DropResult = {
        draggableId: 'lead-1',
        type: 'DEFAULT',
        source: { droppableId: 'stage-1', index: 0 },
        destination: { droppableId: 'stage-2', index: 0 },
        reason: 'DROP',
        mode: 'FLUID',
      };

      await act(async () => {
        await result.current.onDragEnd(dropResult);
      });

      // Verify PATCH payload contains version
      expect(global.fetch).toHaveBeenCalledWith('/api/leads/lead-1/stage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage_id: 'stage-2',
          version: '2026-08-20T12:00:00Z',
        }),
      });
    });

    it('handles cache when lead has no updated_at, lead is missing, or cache is non-array/null', async () => {
      const { Wrapper, queryClient } = createWrapper();

      // 1. Lead has no updated_at
      queryClient.setQueryData(['kanban-leads'], [{ id: 'lead-1', stage_id: 'stage-1' }]);
      const { result } = renderHook(() => useKanbanBoard(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.onDragEnd({
          draggableId: 'lead-1',
          type: 'DEFAULT',
          source: { droppableId: 'stage-1', index: 0 },
          destination: { droppableId: 'stage-2', index: 0 },
          reason: 'DROP',
          mode: 'FLUID',
        });
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/leads/lead-1/stage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage_id: 'stage-2',
          version: undefined,
        }),
      });

      // 2. Cache is non-array object
      queryClient.setQueryData(['kanban-leads'], { someData: 'non-array' });
      await act(async () => {
        await result.current.onDragEnd({
          draggableId: 'lead-1',
          type: 'DEFAULT',
          source: { droppableId: 'stage-1', index: 0 },
          destination: { droppableId: 'stage-3', index: 0 },
          reason: 'DROP',
          mode: 'FLUID',
        });
      });

      // 3. Cache is null/undefined
      queryClient.setQueryData(['kanban-leads'], null);
      await act(async () => {
        await result.current.onDragEnd({
          draggableId: 'lead-1',
          type: 'DEFAULT',
          source: { droppableId: 'stage-1', index: 0 },
          destination: { droppableId: 'stage-4', index: 0 },
          reason: 'DROP',
          mode: 'FLUID',
        });
      });
    });

    it('exercises optimistic updater with non-array and null old values', async () => {
      const { Wrapper, queryClient } = createWrapper();
      const { result } = renderHook(() => useKanbanBoard(), { wrapper: Wrapper });

      // Directly verify setQueriesData updater logic
      let capturedUpdater: any;
      jest.spyOn(queryClient, 'setQueriesData').mockImplementation((_filters, updater: any) => {
        capturedUpdater = updater;
        return undefined as any;
      });

      await act(async () => {
        await result.current.onDragEnd({
          draggableId: 'lead-1',
          type: 'DEFAULT',
          source: { droppableId: 'stage-1', index: 0 },
          destination: { droppableId: 'stage-2', index: 0 },
          reason: 'DROP',
          mode: 'FLUID',
        });
      });

      expect(capturedUpdater).toBeDefined();

      // Test updater with null
      expect(capturedUpdater(null)).toBeNull();

      // Test updater with undefined
      expect(capturedUpdater(undefined)).toBeUndefined();

      // Test updater with non-array object
      const nonArray = { leads: [] };
      expect(capturedUpdater(nonArray)).toBe(nonArray);

      // Test updater with array
      const arr = [
        { id: 'lead-1', stage_id: 'stage-1' },
        { id: 'lead-2', stage_id: 'stage-1' },
      ];
      const updated = capturedUpdater(arr);
      expect(updated).toEqual([
        { id: 'lead-1', stage_id: 'stage-2' },
        { id: 'lead-2', stage_id: 'stage-1' },
      ]);
    });
  });

  describe('Server response handling & error callbacks', () => {
    it('handles successful PATCH and invalidates kanban-leads query', async () => {
      const onError = jest.fn();
      const { Wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useKanbanBoard({ onError }), { wrapper: Wrapper });

      await act(async () => {
        await result.current.onDragEnd({
          draggableId: 'lead-1',
          type: 'DEFAULT',
          source: { droppableId: 'stage-1', index: 0 },
          destination: { droppableId: 'stage-2', index: 0 },
          reason: 'DROP',
          mode: 'FLUID',
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['kanban-leads'] });
      expect(onError).not.toHaveBeenCalled();
    });

    it('handles 409 Conflict, invalidates cache, and calls onError with conflict=true', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 409,
      } as Response);

      const onError = jest.fn();
      const { Wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useKanbanBoard({ onError }), { wrapper: Wrapper });

      await act(async () => {
        await result.current.onDragEnd({
          draggableId: 'lead-1',
          type: 'DEFAULT',
          source: { droppableId: 'stage-1', index: 0 },
          destination: { droppableId: 'stage-2', index: 0 },
          reason: 'DROP',
          mode: 'FLUID',
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['kanban-leads'] });
      expect(onError).toHaveBeenCalledWith(
        new Error('Lead was modified by another user. Please refresh.'),
        true,
      );
    });

    it('handles 500 error, invalidates cache, and calls onError with conflict=false', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const onError = jest.fn();
      const { Wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useKanbanBoard({ onError }), { wrapper: Wrapper });

      await act(async () => {
        await result.current.onDragEnd({
          draggableId: 'lead-1',
          type: 'DEFAULT',
          source: { droppableId: 'stage-1', index: 0 },
          destination: { droppableId: 'stage-2', index: 0 },
          reason: 'DROP',
          mode: 'FLUID',
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['kanban-leads'] });
      expect(onError).toHaveBeenCalledWith(
        new Error('Failed to update lead stage: 500'),
        false,
      );
    });

    it('handles fetch exception (network failure), invalidates cache, and calls onError with conflict=false', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network disconnected'));

      const onError = jest.fn();
      const { Wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useKanbanBoard({ onError }), { wrapper: Wrapper });

      await act(async () => {
        await result.current.onDragEnd({
          draggableId: 'lead-1',
          type: 'DEFAULT',
          source: { droppableId: 'stage-1', index: 0 },
          destination: { droppableId: 'stage-2', index: 0 },
          reason: 'DROP',
          mode: 'FLUID',
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['kanban-leads'] });
      expect(onError).toHaveBeenCalledWith(
        new Error('Network disconnected'),
        false,
      );
    });

    it('does not crash when 409 or 500 occurs and onError is not provided in options', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 409,
      } as Response);

      const { Wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      // No options passed
      const { result } = renderHook(() => useKanbanBoard(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.onDragEnd({
          draggableId: 'lead-1',
          type: 'DEFAULT',
          source: { droppableId: 'stage-1', index: 0 },
          destination: { droppableId: 'stage-2', index: 0 },
          reason: 'DROP',
          mode: 'FLUID',
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['kanban-leads'] });
    });
  });
});
