import { exceedsBodyLimit, isSameOriginRequest, shouldRejectCsrf } from '../request-guards';

function request(overrides: { method?: string; origin?: string; referer?: string; cookie?: boolean; length?: string } = {}) {
  const headers = new Headers();
  if (overrides.origin) headers.set('origin', overrides.origin);
  if (overrides.referer) headers.set('referer', overrides.referer);
  if (overrides.length) headers.set('content-length', overrides.length);
  return {
    method: overrides.method ?? 'POST',
    headers,
    nextUrl: new URL('https://app.example.test/api/action'),
    cookies: { get: (name: string) => name === 'next-auth.session-token' && overrides.cookie ? { name, value: 'token' } : undefined },
  } as any;
}

describe('request security guards', () => {
  it('accepts same-origin origin and referer', () => {
    expect(isSameOriginRequest(request({ origin: 'https://app.example.test' }))).toBe(true);
    expect(isSameOriginRequest(request({ referer: 'https://app.example.test/form' }))).toBe(true);
  });

  it('rejects cross-origin cookie-authenticated mutations', () => {
    expect(shouldRejectCsrf(request({ cookie: true, origin: 'https://evil.example' }))).toBe(true);
    expect(shouldRejectCsrf(request({ cookie: true }))).toBe(true);
    expect(shouldRejectCsrf(request({ cookie: false, origin: 'https://evil.example' }))).toBe(false);
  });

  it('does not apply CSRF guard to safe methods and rejects oversized bodies', () => {
    expect(shouldRejectCsrf(request({ method: 'GET', cookie: true }))).toBe(false);
    expect(exceedsBodyLimit(request({ length: '1048577' }))).toBe(true);
    expect(exceedsBodyLimit(request({ length: '1048576' }))).toBe(false);
  });
});
