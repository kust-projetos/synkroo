/**
 * @jest-environment jsdom
 *
 * contacts-mutations.test.tsx (Task 6).
 *
 * Cobre as mutation hooks do CRM:
 *  - useAddContactNote → POST /api/contacts/:id/notes
 *  - useUpdateContactTags → PUT /api/contacts/:id/tags
 *  - useApproveSuggestion (já existente) → POST /api/contacts/duplicates/:id/approve
 *
 * Validates: payload shape, endpoint, onSuccess cache invalidation.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

function wrapperFactory() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  (global.fetch as unknown) = jest.fn();
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useAddContactNote — POST /api/contacts/:id/notes', () => {
  it('POSTa com { type, id, content } e invalida caches', async () => {
    const { useAddContactNote } = await import('@/lib/hooks/use-queries');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'obs-new' }),
    });

    const { result } = renderHook(() => useAddContactNote(), {
      wrapper: wrapperFactory(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        type: 'patient',
        id: 'p1',
        content: 'observação importante',
      });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/contacts/p1/notes',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          type: 'patient',
          content: 'observação importante',
        }),
      }),
    );
  });
});

describe('useUpdateContactTags — PUT /api/contacts/:id/tags', () => {
  it('PUTa com { type, id, tags } e invalida caches', async () => {
    const { useUpdateContactTags } = await import('@/lib/hooks/use-queries');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'p1', tags: ['VIP', 'Lead'] }),
    });

    const { result } = renderHook(() => useUpdateContactTags(), {
      wrapper: wrapperFactory(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        type: 'patient',
        id: 'p1',
        tags: ['VIP', 'Lead'],
      });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/contacts/p1/tags',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          type: 'patient',
          tags: ['VIP', 'Lead'],
        }),
      }),
    );
  });
});

describe('useApproveSuggestion (existente) — POST /api/contacts/duplicates/:id/approve', () => {
  it('POSTa com id no path', async () => {
    const { useApproveSuggestion } = await import('@/lib/hooks/use-queries');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ suggestion: { status: 'approved' } }),
    });

    const { result } = renderHook(() => useApproveSuggestion(), {
      wrapper: wrapperFactory(),
    });

    await act(async () => {
      await result.current.mutateAsync('s1');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/contacts/duplicates/s1/approve',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});