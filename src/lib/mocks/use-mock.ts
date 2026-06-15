/**
 * Mock mode detection — activated by NEXT_PUBLIC_USE_MOCKS env flag.
 * Client-side only; Next.js exposes NEXT_PUBLIC_* vars to the browser bundle.
 */

/**
 * Returns true when mock mode is active.
 * In the browser, checks process.env.NEXT_PUBLIC_USE_MOCKS.
 * In tests, checks the same env var (Jest reads .env.test or process.env).
 */
export function isMockMode(): boolean {
  // Build-time: Next.js replaces process.env.NEXT_PUBLIC_* with literal values
  // Runtime: falls back to actual process.env for test/SSR
  try {
    return process.env.NEXT_PUBLIC_USE_MOCKS === 'true'
  } catch {
    return false
  }
}
