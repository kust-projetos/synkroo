/** @jest-environment jsdom */
/**
 * ReportsView — Relatórios screen.
 * Live-app reference for the Mês tab (cycle 2026-07):
 *   RESULTADO DO PERÍODO: -R$ 245,00
 *   Receitas: R$ 0,00     Despesas: R$ 245,00
 *   Poupado: 0,0%         TICKET MÉDIO: R$ 245,00
 *   TAXA DE POUPANÇA: 0,0%  (meta 20%)
 */
import { render, screen } from '@testing-library/react'
import { ReportsView } from '../reports-view'
import { initialFinanceData } from '@/lib/pi-finance/seed'

describe('ReportsView', () => {
  it('renders the period summary for the Mês tab with seed values', () => {
    render(<ReportsView data={initialFinanceData} onBack={() => {}} />)
    expect(screen.getByText(/RESULTADO DO PER/i)).toBeInTheDocument()
    expect(screen.getAllByText(/-R\$ 245,00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 0,00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 245,00/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Poupado/i)).toBeInTheDocument()
    expect(screen.getByText(/TICKET MÉDIO/i)).toBeInTheDocument()
    expect(screen.getByText(/TAXA DE POUPANÇA/i)).toBeInTheDocument()
  })

  it('shows period tabs (Mês / Anterior / Trim. / Ano)', () => {
    render(<ReportsView data={initialFinanceData} onBack={() => {}} />)
    expect(screen.getByRole('tab', { name: /Mês/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Anterior/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Trim\./i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Ano/i })).toBeInTheDocument()
  })
})
