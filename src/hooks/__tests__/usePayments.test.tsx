/**
 * @jest-environment jsdom
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePayments, useRecordPayment } from '../usePayments';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('usePayments canonical (T5)', () => {
  beforeEach(() => {
    (global.fetch as unknown) = jest.fn();
  });

  it('fetches via canonical /api/financeiro/budgets/:id/payments and handles { data } envelope', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'pay-1', amount: 100 }] }),
    });

    const { result } = renderHook(() => usePayments('budget-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith('/api/financeiro/budgets/budget-1/payments');
    expect(result.current.data).toEqual([{ id: 'pay-1', amount: 100 }]);
  });

  it('falls back to legacy { payments } shape if canonical not yet', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ payments: [{ id: 'pay-2' }] }),
    });
    const { result } = renderHook(() => usePayments('budget-2'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'pay-2' }]);
  });

  it('skips when budgetId is null', () => {
    const { result } = renderHook(() => usePayments(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('records payment via canonical POST with camelCase and handles response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'pay-new', budget_id: 'budget-1' } }),
    });

    const { result } = renderHook(() => useRecordPayment(), { wrapper: createWrapper() });
    await act(async () => {
      const res = await result.current.mutateAsync({ budget_id: 'budget-1', amount: 50, payment_method: 'pix' });
      expect(res.payment.id).toBe('pay-new');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/financeiro/budgets/budget-1/payments',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetId: 'budget-1', amount: 50, paymentMethod: 'pix', notes: undefined }),
      }),
    );
  });

  it('throws on fetch error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    const { result } = renderHook(() => usePayments('budget-err'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
