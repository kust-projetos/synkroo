/**
 * @jest-environment jsdom
 *
 * P8 Slice 1 — `useIaActivity`: busca GET /api/dashboard/activity sob a key
 * tenant-scoped `queryKeys.iaActivity` (troca de clínica → key distinta,
 * critério 6 "troca").
 */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryKeys, useIaActivity } from '@/lib/hooks/use-queries'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const payload = {
  counts: { runs: { observed: 2 }, goals: {}, journeys: {}, total: 2 },
  recent: [],
}

describe('useIaActivity', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: payload }),
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('usa key tenant-scoped e busca o endpoint de atividade', async () => {
    expect(queryKeys.iaActivity('clinic-x')).toEqual(['clinic', 'clinic-x', 'dashboard', 'activity'])
    expect(queryKeys.iaActivity('clinic-y')).not.toEqual(queryKeys.iaActivity('clinic-x'))

    const { result } = renderHook(() => useIaActivity('clinic-x'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/dashboard/activity')
    expect(result.current.data).toEqual(payload)
  })
})
