/** @jest-environment jsdom */
/**
 * AccountsView — Contas screen.
 * Live-app reference: "Saldo somado R$ 29.550,70 · 6 contas",
 * lists every active bank with its balance and the latest 3 transactions.
 */
import { render, screen } from '@testing-library/react'
import { AccountsView } from '../accounts-view'
import { initialFinanceData } from '@/lib/pi-finance/seed'

describe('AccountsView', () => {
  it('renders saldo somado and bank list with seed data', () => {
    render(<AccountsView data={initialFinanceData} onBack={() => {}} />)
    expect(screen.getByText(/Saldo somado/i)).toBeInTheDocument()
    expect(screen.getAllByText(/R\$ 29\.550,70/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/6 contas/i).length).toBeGreaterThan(0)

    // Each active bank appears
    const bankNames = [
      'Conta Corrente Nubank',
      'Poupança Nubank',
      'Conta Corrente Itaú',
      'VR Refeição',
      'PicPay',
      'Carteira',
    ]
    for (const name of bankNames) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0)
    }
  })
})
