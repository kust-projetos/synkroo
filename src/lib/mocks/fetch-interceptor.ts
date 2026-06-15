/**
 * Fetch interceptor for mock mode.
 * When NEXT_PUBLIC_USE_MOCKS=true, overrides window.fetch for GET /api/*
 * requests to return mock data instead of making real network calls.
 *
 * Only intercepts GET requests — mutations (POST/PUT/DELETE/PATCH) pass through
 * to their respective mock handlers in use-queries.ts or analytics-charts.tsx.
 */
import { isMockMode, getMockForUrl } from './index'

let _originalFetch: typeof fetch | null = null
let _installed = false

/**
 * Install mock fetch interceptor. Idempotent — safe to call multiple times.
 */
export function installMockFetch(): void {
  if (_installed) return
  if (!isMockMode()) return

  if (typeof window === 'undefined') return
  if (typeof window.fetch === 'undefined') return

  _originalFetch = window.fetch
  _installed = true

  window.fetch = async function mockFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method || 'GET').toUpperCase()

    // Only intercept GET /api/* calls
    if (method === 'GET' && url.includes('/api/')) {
      const mockData = getMockForUrl(url)
      if (mockData !== null) {
        return new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Pass through to original fetch
    if (!_originalFetch) {
      throw new Error('Mock fetch interceptor: original fetch not available')
    }
    return _originalFetch(input, init)
  } as typeof fetch
}

/**
 * Restore original fetch. Safe to call even if not installed.
 */
export function restoreMockFetch(): void {
  if (!_installed) return
  if (typeof window === 'undefined') return
  if (_originalFetch) {
    window.fetch = _originalFetch
    _originalFetch = null
  }
  _installed = false
}
