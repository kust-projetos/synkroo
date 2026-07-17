/**
 * Storage helpers for the pi-finance snapshot.
 *
 * The app never touches Synkroo's DB or RBAC surfaces — it persists into
 * a single localStorage key (`pi-finance:snapshot:v1`) plus the token key
 * (`pi-finance:token`). All helpers accept an injected StorageLike so tests
 * run in node without jsdom.
 */

import type { FinanceSnapshot } from './types'

export const TOKEN_KEY = 'pi-finance:token'
export const SNAPSHOT_KEY = 'pi-finance:snapshot:v1'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  /** Optional; matches the Web Storage API but is not required. */
  clear?(): void
}

function safeParse<T>(raw: string | null): T | null {
  if (raw == null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Tokens in the live app are stored as raw strings (not JSON-encoded) so
 * safe{Read,Write}Token here uses the storage value verbatim. Snapshots,
 * being structured, go through JSON.
 * Read also validates UUID-shape; non-UUID garbage resolves to null.
 */
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function safeParseText(raw: string | null): string | null {
  if (raw == null) return null
  return UUID_RE.test(raw.trim()) ? raw.trim() : null
}

function isFinanceSnapshot(value: unknown): value is FinanceSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.version === 1 &&
    typeof v.token === 'string' &&
    typeof v.syncedAt === 'object' &&
    v.syncedAt !== null &&
    typeof v.data === 'object' &&
    v.data !== null &&
    Array.isArray((v.data as Record<string, unknown>).accounts)
  )
}

export function safeReadToken(storage: StorageLike): string | null {
  return safeParseText(storage.getItem(TOKEN_KEY))
}

export function safeWriteToken(storage: StorageLike, token: string): void {
  storage.setItem(TOKEN_KEY, String(token))
}

export function safeReadSnapshot(storage: StorageLike): FinanceSnapshot | null {
  const parsed = safeParse<unknown>(storage.getItem(SNAPSHOT_KEY))
  return isFinanceSnapshot(parsed) ? parsed : null
}

export function safeWriteSnapshot(storage: StorageLike, snapshot: FinanceSnapshot): void {
  storage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
}

/**
 * Browser-side adapter that exposes `window.localStorage` as a StorageLike.
 * Returns null on the server (no `window`) so callers can guard hydration.
 */
export function localStorageAdapter(): StorageLike | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}
