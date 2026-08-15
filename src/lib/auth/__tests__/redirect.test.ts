import { sanitizeInternalRedirect } from '../redirect'

describe('sanitizeInternalRedirect', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/dashboard?tab=agenda#today', '/dashboard?tab=agenda#today'],
    ['/login', '/login'],
  ])('accepts internal target %s', (value, expected) => {
    expect(sanitizeInternalRedirect(value)).toBe(expected)
  })

  it.each([
    'https://evil.example/phish',
    '//evil.example/phish',
    'javascript:alert(1)',
    '/\\evil.example',
    undefined,
  ])('falls back for unsafe target %s', (value) => {
    expect(sanitizeInternalRedirect(value)).toBe('/dashboard')
  })
})
