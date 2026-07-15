/** @jest-environment jsdom */
/**
 * CardsView — Cartões screen.
 * Live-app reference:
 *   Cartão Nubank · Fecha dia 5 · vence dia 13 · fatura R$ 777,40 · R$ 7.222,60 livre · 9.7% de R$ 8.000,00
 *   Cartão Itaú   · Fecha dia 20 · vence dia 28 · fatura R$ 0,00    · R$ 5.000,00 livre · 0.0% de R$ 5.000,00
 */
import { render, screen } from '@testing-library/react'
import { CardsView } from '../cards-view'
import { initialFinanceData } from '@/lib/pi-finance/seed'

describe('CardsView', () => {
  it('renders both cards with their current invoice and percent of limit', () => {
    render(<CardsView data={initialFinanceData} onBack={() => {}} />)
    expect(screen.getAllByText(/Cartão Nubank/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Cartão Itaú/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 777,40/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 0,00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 7\.222,60/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 5\.000,00/).length).toBeGreaterThan(0)
  })
})
