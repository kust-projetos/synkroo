/**
 * Smoke-test the type surface of pi-finance module.
 * Verifies the public barrel re-exports the expected types and tokens,
 * so consumers can `import { Account } from '@/lib/pi-finance'`.
 */
import {
  PI_FINANCE_TOKEN,
  initialFinanceData,
  createInitialSnapshot,
  formatCurrency,
  formatPercent,
  formatDateLabel,
  getBankAccounts,
  getCreditCards,
  getSummary,
  getCreditSummary,
  getPayableSummary,
  getSpendingByCategory,
  getInsights,
  TOKEN_KEY,
  SNAPSHOT_KEY,
  safeReadToken,
  safeWriteToken,
  safeReadSnapshot,
  safeWriteSnapshot,
  addTransaction,
  addPayable,
  markPayablePaid,
} from '@/lib/pi-finance'

describe('pi-finance barrel', () => {
  it('re-exports the seed token and helpers', () => {
    expect(typeof PI_FINANCE_TOKEN).toBe('string')
    expect(PI_FINANCE_TOKEN).toMatch(/^[0-9a-f-]{36}$/)
    expect(initialFinanceData).toBeDefined()
    expect(typeof createInitialSnapshot).toBe('function')
  })

  it('re-exports storage constants and helpers', () => {
    expect(TOKEN_KEY).toBe('pi-finance:token')
    expect(SNAPSHOT_KEY).toBe('pi-finance:snapshot:v1')
    expect(typeof safeReadToken).toBe('function')
    expect(typeof safeWriteToken).toBe('function')
    expect(typeof safeReadSnapshot).toBe('function')
    expect(typeof safeWriteSnapshot).toBe('function')
  })

  it('re-exports selectors and formatters', () => {
    expect(typeof formatCurrency).toBe('function')
    expect(typeof formatPercent).toBe('function')
    expect(typeof formatDateLabel).toBe('function')
    expect(typeof getBankAccounts).toBe('function')
    expect(typeof getCreditCards).toBe('function')
    expect(typeof getSummary).toBe('function')
    expect(typeof getCreditSummary).toBe('function')
    expect(typeof getPayableSummary).toBe('function')
    expect(typeof getSpendingByCategory).toBe('function')
    expect(typeof getInsights).toBe('function')
  })

  it('re-exports actions', () => {
    expect(typeof addTransaction).toBe('function')
    expect(typeof addPayable).toBe('function')
    expect(typeof markPayablePaid).toBe('function')
  })
})
