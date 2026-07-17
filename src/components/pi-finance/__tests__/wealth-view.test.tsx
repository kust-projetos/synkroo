/** @jest-environment jsdom */
/**
 * WealthView — Patrimônio screen.
 * Live-app reference (R$):
 *   líquido  48.773,30
 *   contas   29.550,70
 *   metas    20.000,00
 *   faturas −777,40
 *   dívidas −0,00
 */
import { render, screen } from '@testing-library/react'
import { WealthView } from '../wealth-view'
import { initialFinanceData } from '@/lib/pi-finance/seed'

describe('WealthView', () => {
  it('renders all the live-app breakdown values', () => {
    render(<WealthView data={initialFinanceData} onBack={() => {}} />)
    expect(screen.getByText(/Patrimônio líquido/i)).toBeInTheDocument()
    expect(screen.getAllByText(/R\$ 48\.773,30/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 29\.550,70/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 20\.000,00/).length).toBeGreaterThan(0)
    // Faturas and Dívidas are rendered as liabilities — negative format
    expect(screen.getAllByText(/-R\$ 777,40/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/-R\$ 0,00/).length).toBeGreaterThan(0)
  })
})
