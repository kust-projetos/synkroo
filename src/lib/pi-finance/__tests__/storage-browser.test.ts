/** @jest-environment jsdom */
/**
 * Slice A extension test — localStorageAdapter() helper.
 * Lives here so jest can run with jsdom without touching slice A's pure
 * (no-DOM) storage suite.
 */
import { localStorageAdapter, safeReadSnapshot, TOKEN_KEY, SNAPSHOT_KEY } from '@/lib/pi-finance'

describe('localStorageAdapter', () => {
  it('returns the browser localStorage object', () => {
    const s = localStorageAdapter()
    expect(s).not.toBeNull()
    expect(typeof s!.setItem).toBe('function')
    expect(typeof s!.getItem).toBe('function')
    expect(typeof s!.removeItem).toBe('function')
  })

  it('round-trips a snapshot written through the adapter', () => {
    const s = localStorageAdapter()!
    s.removeItem(TOKEN_KEY)
    s.removeItem(SNAPSHOT_KEY)
    const snap = {
      version: 1 as const,
      token: '550e8400-e29b-41d4-a716-446655440000',
      syncedAt: {
        accounts: '2026-07-05T00:00:00Z',
        categories: '2026-07-05T00:00:00Z',
        transactions: '2026-07-05T00:00:00Z',
        payables: '2026-07-05T00:00:00Z',
        budgets: '2026-07-05T00:00:00Z',
        goals: '2026-07-05T00:00:00Z',
        cardStatements: '2026-07-05T00:00:00Z',
      },
      data: {
        accounts: [], categories: [], transactions: [],
        payables: [], budgets: [], goals: [], cardStatements: [],
      },
    }
    s.setItem('pi-finance:snapshot:v1', JSON.stringify(snap))
    expect(safeReadSnapshot(s)).toEqual(snap)
  })
})
