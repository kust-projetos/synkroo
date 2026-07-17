/** @jest-environment jsdom */
/**
 * Slice B — PiFinanceApp end-to-end behaviour:
 *  - registration gate when localStorage is empty
 *  - Registrar writes token+snapshot and switches to Resumo
 *  - bottom-nav tabs (Registros, A pagar, Mais) each show their anchor content
 *  - Quick action Receita updates the visible income card
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { PiFinanceApp } from '../pi-finance-app'

const TOKEN = 'cee1a6d7-77f7-4efb-a2a0-06877f6026ea'

beforeEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/pi-finance')
})

describe('PiFinanceApp — registration gate', () => {
  it('shows the registration gate when localStorage has no token', () => {
    render(<PiFinanceApp />)
    expect(screen.getByText(/Pi Financeiro/i)).toBeInTheDocument()
    expect(screen.getByText(/Registre seu dispositivo/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Registrar/i })).toBeInTheDocument()
  })

  it('clicking Registrar persists token and snapshot and lands on Resumo', () => {
    render(<PiFinanceApp />)
    fireEvent.click(screen.getByRole('button', { name: /Registrar/i }))

    expect(localStorage.getItem('pi-finance:token')).toBe(TOKEN)
    const snap = JSON.parse(localStorage.getItem('pi-finance:snapshot:v1') || 'null')
    expect(snap).not.toBeNull()
    expect(snap.version).toBe(1)
    expect(snap.token).toBe(TOKEN)
    expect(Array.isArray(snap.data.accounts)).toBe(true)

    // Resumo anchor values
    expect(screen.getByText(/Saldo total · contas/i)).toBeInTheDocument()
    expect(screen.getAllByText(/R\$ 29\.550,70/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 34\.995,00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 23\.021,70/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 11\.973,30/).length).toBeGreaterThan(0)
  })
})

describe('PiFinanceApp — bottom nav', () => {
  function registered() {
    render(<PiFinanceApp />)
    fireEvent.click(screen.getByRole('button', { name: /Registrar/i }))
    return screen
  }

  it('Registros tab shows the latest transaction (Seguro Auto)', () => {
    const s = registered()
    fireEvent.click(s.getByRole('button', { name: /Registros/i }))
    // "Seguro Auto" appears in two seed transactions (Mar + Jul); assert at least one.
    expect(screen.getAllByText(/Seguro Auto/i).length).toBeGreaterThan(0)
  })

  it('A pagar tab shows the pending Curso Online payable', () => {
    const s = registered()
    fireEvent.click(s.getByRole('button', { name: /A pagar/i }))
    expect(screen.getByText(/Curso Online/i)).toBeInTheDocument()
    // Summary totals visible
    expect(screen.getAllByText(/R\$ 3\.507,80/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 297,00/).length).toBeGreaterThan(0)
  })

  it('Mais tab shows the eight entry list including Patrimônio', () => {
    const s = registered()
    fireEvent.click(s.getByRole('button', { name: /Mais/i }))
    expect(screen.getByText(/Patrimônio/i)).toBeInTheDocument()
    // Entries all use diacritics in the live-app copy; the Bottom-Nav also
    // has "Mais" but that's outside this subtree.
    const list = screen.getByText(/Patrimônio/i).closest('ul')!
    expect(list.textContent).toMatch(/Contas/)
    expect(list.textContent).toMatch(/Cartões/)
    expect(list.textContent).toMatch(/Orçamentos/)
    expect(list.textContent).toMatch(/Categorias/)
  })
})

describe('PiFinanceApp — quick action', () => {
  it('opening Receita form and submitting updates the visible income total', () => {
    render(<PiFinanceApp />)
    fireEvent.click(screen.getByRole('button', { name: /Registrar/i }))

    // Open the dialog via the FAB
    fireEvent.click(screen.getByRole('button', { name: /Acao rapida/i }))
    // Then pick Receita inside the dialog
    fireEvent.click(screen.getByRole('button', { name: /Receita/i }))
    // Fill form
    fireEvent.change(screen.getByLabelText(/Descri[cç]ão/i), { target: { value: 'Bonus teste' } })
    fireEvent.change(screen.getByLabelText(/Valor/i), { target: { value: '100,00' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar/i }))

    // New income total = 3499500 + 10000 = 3509500 -> R$ 35.095,00
    expect(screen.getAllByText(/R\$ 35\.095,00/).length).toBeGreaterThan(0)
  })
})
