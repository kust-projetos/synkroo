import { exceedsBodyLimit, isSameOriginRequest, shouldRejectCsrf } from '../request-guards';

function request(overrides: { method?: string; origin?: string; referer?: string; cookie?: boolean; length?: string; url?: string } = {}) {
  const headers = new Headers();
  if (overrides.origin) headers.set('origin', overrides.origin);
  if (overrides.referer) headers.set('referer', overrides.referer);
  if (overrides.length) headers.set('content-length', overrides.length);
  return {
    method: overrides.method ?? 'POST',
    headers,
    nextUrl: new URL(overrides.url ?? 'https://app.example.test/api/action'),
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

  it('treats loopback hosts as same-origin (localhost/127.0.0.1/[::1])', () => {
    const url = 'http://localhost:3003/api/action';
    expect(isSameOriginRequest(request({ url, origin: 'http://127.0.0.1:3003' }))).toBe(true);
    expect(isSameOriginRequest(request({ url, origin: 'http://[::1]:3003' }))).toBe(true);
    expect(isSameOriginRequest(request({ url, origin: 'http://localhost:3003' }))).toBe(true);
    expect(isSameOriginRequest(request({ url: 'http://127.0.0.1:3003/api/action', origin: 'http://localhost:3003' }))).toBe(true);
    expect(isSameOriginRequest(request({ url, referer: 'http://127.0.0.1:3003/form' }))).toBe(true);
  });

  it('keeps deny-by-default: loopback mismatch and cross-site still rejected (null never same-origin)', () => {
    const url = 'http://localhost:3003/api/action';
    expect(isSameOriginRequest(request({ url, origin: 'https://evil.example' }))).toBe(false);
    expect(shouldRejectCsrf(request({ url, cookie: true, origin: 'https://evil.example' }))).toBe(true);
    // Porta diferente em loopback não é mesma origem
    expect(isSameOriginRequest(request({ url, origin: 'http://127.0.0.1:3004' }))).toBe(false);
    // Ausência de Origin+Referer com sessão continua rejeitada
    expect(isSameOriginRequest(request({ url }))).toBe(false);
    expect(shouldRejectCsrf(request({ url, cookie: true }))).toBe(true);
  });
});
