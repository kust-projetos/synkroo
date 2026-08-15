const INTERNAL_ORIGIN = 'http://synkroo.internal'
const DEFAULT_REDIRECT = '/dashboard'

export function sanitizeInternalRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT,
): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback
  }

  try {
    const parsed = new URL(value, INTERNAL_ORIGIN)
    if (parsed.origin !== INTERNAL_ORIGIN) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
