/**
 * @jest-environment jsdom
 */

import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { ScheduleSummaryBar } from '../ScheduleSummaryBar'

describe('ScheduleSummaryBar', () => {
  it('renders period, change, and attention summaries', () => {
    render(
      <ScheduleSummaryBar
        periodLabel="Hoje"
        appointmentCount={12}
        aiChangesCount={3}
        manualChangesCount={1}
        attentionCount={2}
      />,
    )

    expect(screen.getByText(/12 agendamentos/i)).toBeInTheDocument()
    expect(screen.getByText(/3 alterações da IA/i)).toBeInTheDocument()
    expect(screen.getByText(/2 itens de atenção/i)).toBeInTheDocument()
  })

  it('renders zero counts correctly', () => {
    render(
      <ScheduleSummaryBar
        periodLabel="Semana"
        appointmentCount={0}
        aiChangesCount={0}
        manualChangesCount={0}
        attentionCount={0}
      />,
    )

    expect(screen.getByText(/0 agendamentos/i)).toBeInTheDocument()
    expect(screen.getByText(/0 alterações da IA/i)).toBeInTheDocument()
    expect(screen.getByText(/0 itens de atenção/i)).toBeInTheDocument()
  })

  it('renders manual changes count', () => {
    render(
      <ScheduleSummaryBar
        periodLabel="Hoje"
        appointmentCount={5}
        aiChangesCount={2}
        manualChangesCount={4}
        attentionCount={1}
      />,
    )

    expect(screen.getByText(/4 manuais/i)).toBeInTheDocument()
  })
})
