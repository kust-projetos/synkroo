/**
 * storage.test.ts — verifies token/snapshot storage helpers with an injected
 * StorageLike. No real localStorage is touched (runs in jest node env).
 */
import {
  TOKEN_KEY,
  SNAPSHOT_KEY,
  safeReadToken,
  safeWriteToken,
  safeReadSnapshot,
  safeWriteSnapshot,
  type StorageLike,
} from '@/lib/pi-finance/storage'
import type { FinanceSnapshot } from '@/lib/pi-finance/types'

class MemStorage implements StorageLike {
  private map = new Map<string, string>()
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null }
  setItem(k: string, v: string) { this.map.set(k, String(v)) }
  removeItem(k: string) { this.map.delete(k) }
}

describe('pi-finance storage', () => {
  it('exports the expected localStorage key names', () => {
    expect(TOKEN_KEY).toBe('pi-finance:token')
    expect(SNAPSHOT_KEY).toBe('pi-finance:snapshot:v1')
  })

  it('safeWriteToken / safeReadToken round-trip', () => {
    const s = new MemStorage()
    expect(safeReadToken(s)).toBeNull()
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    safeWriteToken(s, uuid)
    expect(safeReadToken(s)).toBe(uuid)
    expect(s.getItem(TOKEN_KEY)).toBe(uuid)
  })

  it('safeReadToken survives corrupted JSON without throwing', () => {
    const s = new MemStorage()
    s.setItem(TOKEN_KEY, '{not json')
    expect(() => safeReadToken(s)).not.toThrow()
    expect(safeReadToken(s)).toBeNull()
  })

  it('safeWriteSnapshot / safeReadSnapshot round-trip', () => {
    const s = new MemStorage()
    const snap: FinanceSnapshot = {
      version: 1,
      token: 'tok',
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
    safeWriteSnapshot(s, snap)
    const read = safeReadSnapshot(s)
    expect(read).toEqual(snap)
  })

  it('safeReadSnapshot returns null when storage is empty or corrupted', () => {
    const s = new MemStorage()
    expect(safeReadSnapshot(s)).toBeNull()
    s.setItem(SNAPSHOT_KEY, 'not-json{')
    expect(safeReadSnapshot(s)).toBeNull()
  })

  it('safeReadSnapshot validates the shape and returns null for foreign data', () => {
    const s = new MemStorage()
    s.setItem(SNAPSHOT_KEY, JSON.stringify({ hello: 'world' }))
    expect(safeReadSnapshot(s)).toBeNull()
  })
})
