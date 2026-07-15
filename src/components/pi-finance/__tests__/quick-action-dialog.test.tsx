/** @jest-environment jsdom */
/**
 * quick-action-dialog tests: minimal form contract.
 *  - shows Despesa/Receita/Transferir entry buttons
 *  - Despesa form calls onSubmit with parsed payload
 *  - Transferir shows informative disabled state
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { QuickActionDialog } from '../quick-action-dialog'

const ACCOUNTS = [
  { id: 'a1', householdId: 'h', name: 'Nubank', kind: 'bank' as const, balanceCents: 100000, status: 'active' as const },
]
const CATEGORIES = [
  { id: 'c1', householdId: 'h', name: 'Renda > Salário', kind: 'income' as const, status: 'active' as const },
  { id: 'c2', householdId: 'h', name: 'Moradia > Aluguel', kind: 'expense' as const, status: 'active' as const },
]

describe('QuickActionDialog', () => {
  it('renders entry buttons for Despesa / Receita / Transferir', () => {
    render(
      <QuickActionDialog
        open
        onOpenChange={() => {}}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        onSubmit={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /Despesa/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Receita/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Transferir/i })).toBeInTheDocument()
  })

  it('Despesa form: filling and submitting calls onSubmit with parsed payload', () => {
    const onSubmit = jest.fn()
    render(
      <QuickActionDialog
        open
        onOpenChange={() => {}}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        onSubmit={onSubmit}
      />
    )
    // pick expense kind
    fireEvent.click(screen.getByRole('button', { name: /Despesa/i }))
    fireEvent.change(screen.getByLabelText(/Descrição/i), { target: { value: 'Mercado' } })
    fireEvent.change(screen.getByLabelText(/Valor/i), { target: { value: '50,00' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const arg = onSubmit.mock.calls[0][0]
    expect(arg.kind).toBe('expense')
    expect(arg.amountCents).toBe(5000)
    expect(arg.description).toBe('Mercado')
    expect(arg.accountId).toBe('a1')
    expect(typeof arg.categoryId).toBe('string')
  })

  it('Transferir is shown as informational / disabled (no model action yet)', () => {
    render(
      <QuickActionDialog
        open
        onOpenChange={() => {}}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        onSubmit={() => {}}
      />
    )
    const btn = screen.getByRole('button', { name: /Transferir/i })
    fireEvent.click(btn)
    expect(screen.getByText(/em breve/i)).toBeInTheDocument()
  })
})
