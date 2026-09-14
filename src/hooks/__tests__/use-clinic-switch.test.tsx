/**
 * @jest-environment jsdom
 *
 * G1 — cache multi-tenant por clínica (comportamental, sem readFileSync).
 * - Isolamento: mesma query com clinicIds distintos gera entradas de cache
 *   distintas e os dados de A nunca vazam para B.
 * - Resolução via contexto: sem clinicId explícito, o hook usa o profile do
 *   AuthContext como fonte do tenant.
 * - Troca de clínica: switchClinic cancela requests em voo (cancelQueries)
 *   antes de limpar o cache (clear).
 */

import React from 'react'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext, AuthProvider, useAuth } from '@/lib/auth/context'
import { queryKeys, useDashboardStats } from '@/lib/hooks/use-queries'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}))

const mockUpdate = jest.fn().mockResolvedValue(undefined)
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'u1', email: 'a@a.com' } },
    status: 'authenticated',
    update: mockUpdate,
  }),
  signIn: jest.fn(),
  signOut: jest.fn(),
}))

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}

describe('G1 clinic-scoped frontend cache (behavioral)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as unknown) = jest.fn()
  })

  it('isola o cache por clínica: dados de A não vazam para B', async () => {
    const client = makeClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total: 'A' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total: 'B' }) })

    const hookA = renderHook(() => useDashboardStats('clinic-A'), { wrapper })
    await waitFor(() => expect(hookA.result.current.isSuccess).toBe(true))
    expect(hookA.result.current.data).toEqual({ total: 'A' })

    const hookB = renderHook(() => useDashboardStats('clinic-B'), { wrapper })
    await waitFor(() => expect(hookB.result.current.isSuccess).toBe(true))
    expect(hookB.result.current.data).toEqual({ total: 'B' })

    // Keys carregam o tenant no segmento [1]...
    expect(queryKeys.dashboardStats('clinic-A')[1]).toBe('clinic-A')
    expect(queryKeys.dashboardStats('clinic-B')[1]).toBe('clinic-B')
    // ...e cada entrada guarda seus próprios dados.
    expect(client.getQueryData(queryKeys.dashboardStats('clinic-A'))).toEqual({ total: 'A' })
    expect(client.getQueryData(queryKeys.dashboardStats('clinic-B'))).toEqual({ total: 'B' })
  })

  it('resolve o tenant do profile quando nenhum clinicId explícito é passado', async () => {
    const client = makeClient()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total: 'CTX' }),
    })

    const fakeAuthValue = {
      profile: { clinic_id: 'clinic-CTX' },
    } as unknown as React.ContextType<typeof AuthContext>

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={fakeAuthValue}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    )

    const hook = renderHook(() => useDashboardStats(), { wrapper })
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))

    expect(client.getQueryData(queryKeys.dashboardStats('clinic-CTX'))).toEqual({ total: 'CTX' })
    expect(client.getQueryData(queryKeys.dashboardStats('clinic-OTHER'))).toBeUndefined()
  })

  it('switchClinic cancela queries em voo antes de limpar o cache', async () => {
    const client = makeClient()
    const cancelSpy = jest.spyOn(client, 'cancelQueries')
    const clearSpy = jest.spyOn(client, 'clear')

    // Query pendente (em voo) no momento da troca.
    void client.prefetchQuery({
      queryKey: queryKeys.dashboardStats('clinic-A'),
      queryFn: () => new Promise(() => {}),
    })

    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/auth/switch-clinic')) {
        return Promise.resolve({ ok: true, json: async () => ({}) })
      }
      if (typeof url === 'string' && url.includes('/api/auth/session')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            authenticated: true,
            profile: { clinic_id: 'clinic-B', email: 'a@a.com', id: 'u1' },
          }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    let api: ReturnType<typeof useAuth> | null = null
    function Probe() {
      const auth = useAuth()
      React.useEffect(() => {
        api = auth
      }, [auth])
      return null
    }

    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(api).not.toBeNull())
    await act(async () => {
      await api!.switchClinic('clinic-B')
    })

    expect(cancelSpy).toHaveBeenCalled()
    expect(clearSpy).toHaveBeenCalled()
    expect(cancelSpy.mock.invocationCallOrder[0]).toBeLessThan(clearSpy.mock.invocationCallOrder[0])
  })
})
