/** @jest-environment jsdom */
/**
 * Slice C — Drilldowns from Resumo "Ver tudo" buttons.
 * Each click must navigate to the matching more-tab subview with REAL
 * implementation (no placeholder text).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { initialFinanceData } from '@/lib/pi-finance/seed'
import { PiFinanceApp } from '../pi-finance-app'

beforeEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/pi-finance')
})

describe('PiFinanceApp — Summary drilldowns', () => {
  function registeredScreen() {
    render(<PiFinanceApp />)
    fireEvent.click(screen.getByRole('button', { name: /Registrar/i }))
    return screen
  }

  it('"Ver tudo" em Minhas contas abre a tela real de Contas', () => {
    registeredScreen()
    const buttons = screen.getAllByRole('button', { name: /Ver tudo/i })
    // First Ver tudo in Summary = Minhas contas → navigate to 'contas'
    fireEvent.click(buttons[0]!)
    expect(screen.getByText(/Saldo somado/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Conta Corrente Nubank/i).length).toBeGreaterThan(0)
  })

  it('"Ver tudo" em Cartões de crédito abre a tela real de Cartões', () => {
    const s = registeredScreen()
    const buttons = screen.getAllByRole('button', { name: /Ver tudo/i })
    // second Ver tudo = cartoes
    fireEvent.click(buttons[1]!)
    expect(screen.getAllByText(/Cartão Nubank/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 777,40/).length).toBeGreaterThan(0)
  })
})

describe('PiFinanceApp — More tab detail screens', () => {
  function openMore(screenToUse: typeof screen, label: RegExp) {
    fireEvent.click(screenToUse.getByRole('button', { name: /Mais/i }))
    fireEvent.click(screenToUse.getByRole('button', { name: label }))
  }

  it('Patrimônio shows net-worth breakdown', () => {
    render(<PiFinanceApp />)
    fireEvent.click(screen.getByRole('button', { name: /Registrar/i }))
    openMore(screen, /Patrimônio/i)
    expect(screen.getAllByText(/R\$ 48\.773,30/).length).toBeGreaterThan(0)
  })

  it('Contas shows Saldo somado and the seed accounts', () => {
    render(<PiFinanceApp />)
    fireEvent.click(screen.getByRole('button', { name: /Registrar/i }))
    openMore(screen, /^Contas /i)
    expect(screen.getByText(/Saldo somado/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Conta Corrente Nubank/i).length).toBeGreaterThan(0)
  })

  it('Cartões shows Cartão Nubank + R$ 777,40', () => {
    render(<PiFinanceApp />)
    fireEvent.click(screen.getByRole('button', { name: /Registrar/i }))
    openMore(screen, /^Cartões /i)
    expect(screen.getAllByText(/Cartão Nubank/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 777,40/).length).toBeGreaterThan(0)
  })

  it('Relatórios shows RESULTADO DO PERÍODO + -R$ 245,00', () => {
    render(<PiFinanceApp />)
    fireEvent.click(screen.getByRole('button', { name: /Registrar/i }))
    openMore(screen, /^Relatórios /i)
    expect(screen.getByText(/RESULTADO DO PER/i)).toBeInTheDocument()
    expect(screen.getAllByText(/-R\$ 245,00/).length).toBeGreaterThan(0)
  })

  it('restores deep-link state from URL on refresh-like render', () => {
    window.history.pushState({}, '', '/pi-finance?tab=mais&view=patrimonio')
    localStorage.setItem('pi-finance:token', 'cee1a6d7-77f7-4efb-a2a0-06877f6026ea')
    localStorage.setItem(
      'pi-finance:snapshot:v1',
      JSON.stringify({
        version: 1,
        token: 'cee1a6d7-77f7-4efb-a2a0-06877f6026ea',
        syncedAt: {
          accounts: new Date().toISOString(),
          categories: new Date().toISOString(),
          transactions: new Date().toISOString(),
          payables: new Date().toISOString(),
          budgets: new Date().toISOString(),
          goals: new Date().toISOString(),
          cardStatements: new Date().toISOString(),
        },
        data: initialFinanceData,
      }),
    )

    render(<PiFinanceApp />)
    expect(screen.getAllByText(/R\$ 48\.773,30/).length).toBeGreaterThan(0)
  })

  it('writes URL state while navigating drilldowns', () => {
    render(<PiFinanceApp />)
    fireEvent.click(screen.getByRole('button', { name: /Registrar/i }))
    openMore(screen, /^Contas /i)
    expect(window.location.search).toBe('?tab=mais&view=contas')
    fireEvent.click(screen.getByRole('button', { name: /Voltar/i }))
    expect(window.location.search).toBe('?tab=mais')
    fireEvent.click(screen.getByRole('button', { name: /A pagar/i }))
    expect(window.location.search).toBe('?tab=pagar')
  })
})
