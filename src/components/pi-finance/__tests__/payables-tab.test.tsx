/** @jest-environment jsdom */
/**
 * payables-tab tests: summary + tabs + mark-paid action.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { PayablesTab } from '../payables-tab'
import { initialFinanceData, markPayablePaid } from '@/lib/pi-finance'

function makeData() {
  return {
    data: initialFinanceData,
    onMarkPaid: (payableId: string) => ({ data: markPayablePaid(initialFinanceData, payableId, '2026-07-05'), payableId }),
  }
}

describe('PayablesTab', () => {
  it('renders summary totals and pending list', () => {
    const { data } = makeData()
    render(<PayablesTab data={data} onMarkPaid={() => {}} />)
    expect(screen.getAllByText(/R\$ 3\.507,80/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 3\.210,80/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$ 297,00/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Curso Online/i)).toBeInTheDocument()
  })

  it('clicking "Marcar paga" on a pending payable triggers onMarkPaid', () => {
    const onMarkPaid = jest.fn()
    const { data } = makeData()
    render(<PayablesTab data={data} onMarkPaid={onMarkPaid} />)
    const buttons = screen.getAllByRole('button', { name: /Marcar paga/i })
    expect(buttons.length).toBeGreaterThan(0)
    fireEvent.click(buttons[0]!)
    expect(onMarkPaid).toHaveBeenCalledTimes(1)
    const arg = onMarkPaid.mock.calls[0][0] as string
    const pending = data.payables.find((p) => p.status === 'pending')
    expect(arg).toBe(pending!.id)
  })
})
