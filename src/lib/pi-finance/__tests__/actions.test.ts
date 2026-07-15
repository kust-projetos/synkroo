/**
 * actions.test.ts — pure mutations on FinanceData.
 * - addTransaction: appends tx and updates account balance (no mutation of input)
 * - addPayable: appends pending payable (no mutation)
 * - markPayablePaid: flips status → paid, creates matching expense tx, debits account
 */
import {
  addTransaction,
  addPayable,
  markPayablePaid,
} from '@/lib/pi-finance/actions'
import { initialFinanceData } from '@/lib/pi-finance/seed'
import type { FinanceData } from '@/lib/pi-finance/types'

describe('pi-finance actions', () => {
  const baseline = initialFinanceData
  const bank = baseline.accounts.find((a) => a.kind === 'bank' && a.status === 'active')!
  const category = baseline.categories.find((c) => c.kind === 'expense')!

  it('addTransaction does not mutate the input data', () => {
    const before = JSON.stringify(baseline.accounts.length)
    const next = addTransaction(baseline, {
      kind: 'expense',
      description: 'teste',
      amountCents: 1000,
      date: '2026-07-05',
      accountId: bank.id,
      categoryId: category.id,
    })
    expect(baseline.transactions.length).toBe(144)
    expect(next.transactions.length).toBe(145)
    expect(JSON.stringify(baseline.accounts.length)).toBe(before)
  })

  it('addTransaction(expense) appends txn and debits bank balance', () => {
    const startBalance = bank.balanceCents
    const next = addTransaction(baseline, {
      kind: 'expense',
      description: 'Café',
      amountCents: 1500,
      date: '2026-07-05',
      accountId: bank.id,
      categoryId: category.id,
    })
    const acc = next.accounts.find((a) => a.id === bank.id)!
    expect(acc.balanceCents).toBe(startBalance - 1500)
    const appended = next.transactions[next.transactions.length - 1]
    expect(appended.description).toBe('Café')
    expect(appended.amountCents).toBe(1500)
    expect(appended.kind).toBe('expense')
    expect(appended.accountId).toBe(bank.id)
    expect(appended.categoryId).toBe(category.id)
  })

  it('addTransaction(income) appends txn and credits bank balance', () => {
    const startBalance = bank.balanceCents
    const next = addTransaction(baseline, {
      kind: 'income',
      description: 'Bonus',
      amountCents: 50000,
      date: '2026-07-05',
      accountId: bank.id,
      categoryId: baseline.categories.find((c) => c.kind === 'income')!.id,
    })
    const acc = next.accounts.find((a) => a.id === bank.id)!
    expect(acc.balanceCents).toBe(startBalance + 50000)
    const appended = next.transactions[next.transactions.length - 1]
    expect(appended.kind).toBe('income')
    expect(appended.amountCents).toBe(50000)
  })

  it('addPayable appends a pending payable', () => {
    const next = addPayable(baseline, {
      accountId: bank.id,
      description: 'Cinema',
      amountCents: 5000,
      dueDate: '2026-07-10',
      categoryId: category.id,
      notes: 'Fim de semana',
    })
    expect(baseline.payables.length).toBe(8)
    expect(next.payables.length).toBe(9)
    const appended = next.payables[next.payables.length - 1]
    expect(appended.status).toBe('pending')
    expect(appended.amountCents).toBe(5000)
    expect(appended.accountId).toBe(bank.id)
    expect(appended.categoryId).toBe(category.id)
    expect(appended.notes).toBe('Fim de semana')
    expect(typeof appended.id).toBe('string')
    expect(appended.id.length).toBeGreaterThan(8)
  })

  it('markPayablePaid flips status, creates expense tx and debits account', () => {
    const pending = baseline.payables.find((p) => p.status === 'pending')!
    expect(pending).toBeDefined()
    const account = baseline.accounts.find((a) => a.id === pending.accountId)!
    const startBalance = account.balanceCents
    const startTxCount = baseline.transactions.length

    const next = markPayablePaid(baseline, pending.id, '2026-07-05')

    // status flipped
    const after = next.payables.find((p) => p.id === pending.id)!
    expect(after.status).toBe('paid')
    expect(after.paidDate).toBe('2026-07-05')

    // new expense transaction created
    expect(next.transactions.length).toBe(startTxCount + 1)
    const newTx = next.transactions[next.transactions.length - 1]
    expect(newTx.kind).toBe('expense')
    expect(newTx.amountCents).toBe(pending.amountCents)
    expect(newTx.accountId).toBe(pending.accountId)
    expect(newTx.categoryId).toBe(pending.categoryId)
    expect(newTx.date).toBe('2026-07-05')

    // account debited
    const afterAcc = next.accounts.find((a) => a.id === pending.accountId)!
    expect(afterAcc.balanceCents).toBe(startBalance - pending.amountCents)

    // input not mutated
    expect(baseline.payables.find((p) => p.id === pending.id)!.status).toBe('pending')
    expect(baseline.transactions.length).toBe(startTxCount)
  })

  it('markPayablePaid on a non-existent id returns data unchanged', () => {
    const start = JSON.stringify(baseline).length
    const next = markPayablePaid(baseline, '00000000-0000-0000-0000-000000000000', '2026-07-05')
    expect(JSON.stringify(next).length).toBe(start)
  })
})
