/**
 * @jest-environment jsdom
 *
 * P8 Slice 1 — IaActivityPanel nos 4 estados: loading / erro (+retry) /
 * vazio (texto herdado do placeholder) / sucesso ("Atualizações recentes"
 * com os literais `observed` + `proposta observada`).
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IaActivityPanel } from '../ia-activity-panel'
import { useIaActivity } from '@/lib/hooks/use-queries'

jest.mock('@/lib/hooks/use-queries', () => {
  const actual = jest.requireActual('@/lib/hooks/use-queries')
  return { ...actual, useIaActivity: jest.fn() }
})

const mockedHook = useIaActivity as jest.Mock

const baseCounts = { runs: { observed: 1 }, goals: { queued: 1 }, journeys: {}, total: 2 }

function state(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('IaActivityPanel', () => {
  it('loading: skeleton acessível', () => {
    mockedHook.mockReturnValue(state({ isLoading: true }))
    render(<IaActivityPanel />)
    expect(screen.getByLabelText('Carregando atividade da IA')).toBeTruthy()
    expect(screen.getByText('Carregando atividade da IA…')).toBeTruthy()
  })

  it('erro: mensagem + retry dispara refetch', () => {
    const refetch = jest.fn()
    mockedHook.mockReturnValue(state({ error: new Error('down'), refetch }))
    render(<IaActivityPanel />)
    expect(screen.getByText('Não foi possível carregar a atividade da IA.')).toBeTruthy()
    fireEvent.click(screen.getByText('Tentar novamente'))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('vazio: texto herdado do placeholder anterior', () => {
    mockedHook.mockReturnValue(
      state({ data: { counts: { runs: {}, goals: {}, journeys: {}, total: 0 }, recent: [] } }),
    )
    render(<IaActivityPanel />)
    expect(screen.getByText('Nenhuma atividade real disponível.')).toBeTruthy()
  })

  it('sucesso: Atualizações recentes com literais observed/proposta observada', () => {
    mockedHook.mockReturnValue(
      state({
        data: {
          counts: baseCounts,
          recent: [
            {
              key: 'run:r1',
              kind: 'run',
              status: 'observed',
              label: 'proposta observada',
              eventType: 'lead.created',
              occurredAt: '2026-10-14T09:55:00.000Z',
              createdAt: '2026-10-14T10:10:00.000Z',
              detail: null,
            },
            {
              key: 'journey:j1',
              kind: 'journey',
              status: 'waiting_feedback',
              label: 'aguardando retorno',
              eventType: 'post_visit',
              occurredAt: null,
              createdAt: '2026-10-14T10:05:00.000Z',
              detail: null,
            },
          ],
        },
      }),
    )
    render(<IaActivityPanel />)
    expect(screen.getByText('Atualizações recentes')).toBeTruthy()
    expect(screen.getByText('proposta observada')).toBeTruthy()
    expect(screen.getByText('observed')).toBeTruthy()
    expect(screen.getByText('aguardando retorno')).toBeTruthy()
  })

  it('R12: 1 evento gerando goal+run queued → 1 goal queued + 1 run queued (nunca "2 eventos observados")', () => {
    mockedHook.mockReturnValue(
      state({
        data: {
          counts: { runs: { queued: 1 }, goals: { queued: 1 }, journeys: {}, total: 2 },
          recent: [
            {
              key: 'run:r1',
              kind: 'run',
              status: 'queued',
              label: 'em observação',
              eventType: 'lead.created',
              occurredAt: '2026-10-14T09:55:00.000Z',
              createdAt: '2026-10-14T10:10:00.000Z',
              detail: null,
            },
          ],
        },
      }),
    )
    render(<IaActivityPanel />)
    expect(screen.getByText(/1 run em observação \(queued\)/)).toBeTruthy()
    expect(screen.getByText(/1 meta em observação \(queued\)/)).toBeTruthy()
    expect(screen.queryByText(/evento\(s\) observado\(s\)/)).toBeNull()
    expect(screen.queryByText(/2 evento/)).toBeNull()
  })
})
