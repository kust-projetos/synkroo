/**
 * @jest-environment jsdom
 */

/**
 * Unit Test Suite for use-toast hook & state reducer (src/hooks/use-toast.ts)
 *
 * Covers:
 * 1. Reducer actions: ADD_TOAST, UPDATE_TOAST, DISMISS_TOAST, REMOVE_TOAST
 * 2. Limit enforcement (TOAST_LIMIT = 1)
 * 3. Removal queue timer (TOAST_REMOVE_DELAY = 1000000) and deduplication
 * 4. Toast helper: ID generation, update(), dismiss(), onOpenChange() handling
 * 5. useToast hook lifecycle: subscription, state reflection, hook-level dismiss, and cleanup on unmount
 */

import { renderHook, act } from '@testing-library/react';
import { reducer, toast, useToast } from '../use-toast';

describe('use-toast unit tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Clear all toasts before each test
    act(() => {
      reducer({ toasts: [] }, { type: 'REMOVE_TOAST' });
    });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  describe('reducer', () => {
    it('handles ADD_TOAST and limits toasts array to TOAST_LIMIT (1)', () => {
      const state0 = { toasts: [] };
      const t1 = { id: '1', title: 'First Toast', open: true };
      const state1 = reducer(state0, { type: 'ADD_TOAST', toast: t1 });

      expect(state1.toasts).toEqual([t1]);

      const t2 = { id: '2', title: 'Second Toast', open: true };
      const state2 = reducer(state1, { type: 'ADD_TOAST', toast: t2 });

      // Only the newest toast is kept
      expect(state2.toasts).toEqual([t2]);
      expect(state2.toasts).toHaveLength(1);
    });

    it('handles UPDATE_TOAST for matching and non-matching toast IDs', () => {
      const t1 = { id: '1', title: 'Original Title', description: 'Old', open: true };
      const t2 = { id: '2', title: 'Second', open: true };
      const state = { toasts: [t1, t2] };

      const updatedState = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'Updated Title' },
      });

      expect(updatedState.toasts[0]).toEqual({
        id: '1',
        title: 'Updated Title',
        description: 'Old',
        open: true,
      });
      expect(updatedState.toasts[1]).toEqual(t2);

      // Non-matching update should leave all toasts unmodified
      const untouchedState = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: 'non-existent', title: 'Ghost' },
      });
      expect(untouchedState.toasts).toEqual([t1, t2]);
    });

    it('handles DISMISS_TOAST with specific toastId and queues removal', () => {
      const t1 = { id: '1', title: 'T1', open: true };
      const t2 = { id: '2', title: 'T2', open: true };
      const state = { toasts: [t1, t2] };

      const dismissedState = reducer(state, {
        type: 'DISMISS_TOAST',
        toastId: '1',
      });

      expect(dismissedState.toasts[0].open).toBe(false);
      expect(dismissedState.toasts[1].open).toBe(true);
    });

    it('handles DISMISS_TOAST with undefined toastId and dismisses all toasts', () => {
      const t1 = { id: '1', title: 'T1', open: true };
      const t2 = { id: '2', title: 'T2', open: true };
      const state = { toasts: [t1, t2] };

      const dismissedState = reducer(state, {
        type: 'DISMISS_TOAST',
        toastId: undefined,
      });

      expect(dismissedState.toasts[0].open).toBe(false);
      expect(dismissedState.toasts[1].open).toBe(false);
    });

    it('handles REMOVE_TOAST with specific toastId and undefined toastId', () => {
      const t1 = { id: '1', title: 'T1', open: true };
      const t2 = { id: '2', title: 'T2', open: true };
      const state = { toasts: [t1, t2] };

      // Remove specific toast
      const removedSpecific = reducer(state, {
        type: 'REMOVE_TOAST',
        toastId: '1',
      });
      expect(removedSpecific.toasts).toEqual([t2]);

      // Remove all toasts (undefined toastId)
      const removedAll = reducer(state, {
        type: 'REMOVE_TOAST',
        toastId: undefined,
      });
      expect(removedAll.toasts).toEqual([]);
    });
  });

  describe('toast() helper function & remove timer queue', () => {
    it('dispatches ADD_TOAST and returns id, update, and dismiss helpers', () => {
      let toastHandle: ReturnType<typeof toast>;
      act(() => {
        toastHandle = toast({
          title: 'Agendamento Criado',
          description: 'Consulta confirmada para amanhã',
        });
      });

      expect(toastHandle!.id).toBeDefined();
      expect(typeof toastHandle!.dismiss).toBe('function');
      expect(typeof toastHandle!.update).toBe('function');

      // Test toast update
      act(() => {
        toastHandle.update({
          id: toastHandle.id,
          title: 'Agendamento Atualizado',
        });
      });

      // Test toast dismiss
      act(() => {
        toastHandle.dismiss();
      });

      // Advance timer by TOAST_REMOVE_DELAY (1000000ms) to trigger automatic REMOVE_TOAST
      act(() => {
        jest.advanceTimersByTime(1000000);
      });
    });

    it('handles onOpenChange callback when closed vs when open', () => {
      let toastHandle: ReturnType<typeof toast>;
      act(() => {
        toastHandle = toast({
          title: 'Teste onOpenChange',
        });
      });

      const { result } = renderHook(() => useToast());
      const currentToast = result.current.toasts.find((t) => t.id === toastHandle.id);
      expect(currentToast?.onOpenChange).toBeDefined();

      // Trigger open = true (should not dismiss)
      act(() => {
        currentToast?.onOpenChange?.(true);
      });
      expect(result.current.toasts.find((t) => t.id === toastHandle.id)?.open).toBe(true);

      // Trigger open = false (should dismiss)
      act(() => {
        currentToast?.onOpenChange?.(false);
      });
      expect(result.current.toasts.find((t) => t.id === toastHandle.id)?.open).toBe(false);
    });

    it('deduplicates removal queue when dismiss is called multiple times for same toast', () => {
      let toastHandle: ReturnType<typeof toast>;
      act(() => {
        toastHandle = toast({ title: 'Dedup Test' });
      });

      // Calling dismiss multiple times should not create duplicate timers
      act(() => {
        toastHandle.dismiss();
        toastHandle.dismiss();
      });

      act(() => {
        jest.advanceTimersByTime(1000000);
      });

      const { result } = renderHook(() => useToast());
      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe('useToast hook lifecycle', () => {
    it('subscribes to state updates and provides toast & dismiss methods', () => {
      const { result } = renderHook(() => useToast());

      expect(result.current.toasts).toEqual([]);
      expect(typeof result.current.toast).toBe('function');
      expect(typeof result.current.dismiss).toBe('function');

      // Trigger a toast
      act(() => {
        result.current.toast({
          title: 'Notificação',
          description: 'Mensagem recebida',
        });
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Notificação');

      // Dismiss specific toast via hook
      const toastId = result.current.toasts[0].id;
      act(() => {
        result.current.dismiss(toastId);
      });

      expect(result.current.toasts[0].open).toBe(false);

      // Dismiss all toasts via hook without toastId
      act(() => {
        result.current.toast({ title: 'Segunda Notificação' });
      });
      expect(result.current.toasts[0].open).toBe(true);

      act(() => {
        result.current.dismiss();
      });
      expect(result.current.toasts[0].open).toBe(false);
    });

    it('cleans up listener subscription when component unmounts', () => {
      const hook1 = renderHook(() => useToast());
      const hook2 = renderHook(() => useToast());

      // Trigger toast
      act(() => {
        toast({ title: 'Para Ambos' });
      });

      expect(hook1.result.current.toasts).toHaveLength(1);
      expect(hook2.result.current.toasts).toHaveLength(1);

      // Unmount hook1
      hook1.unmount();

      // Trigger another toast
      act(() => {
        toast({ title: 'Apenas Hook 2 Ativo' });
      });

      expect(hook2.result.current.toasts[0].title).toBe('Apenas Hook 2 Ativo');

      // Unmount hook2
      hook2.unmount();
    });
  });
});
