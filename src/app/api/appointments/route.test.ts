const mockRateLimit = {
  allowed: true,
  remaining: 60,
  resetTime: Date.now() + 60000,
  retryAfter: 0,
};

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => mockRateLimit),
  getClientIdentifier: jest.fn(() => 'test-client'),
  rateLimitPresets: { api: { windowMs: 60000, maxRequests: 60 } },
}));

jest.mock('@/core/modules/gates', () => ({
  withModuleRoute: () => (handler: unknown) => handler,
}));

jest.mock('@/core/modules/manifest', () => ({
  createManifest: () => ({}),
}));

import { GET, POST } from './route';

function makeGetRequest(): Request {
  return new Request('http://localhost/api/appointments', { method: 'GET' }) as any;
}

function makePostRequest(): Request {
  return new Request('http://localhost/api/appointments', { method: 'POST' }) as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRateLimit.allowed = true;
  mockRateLimit.remaining = 60;
  mockRateLimit.retryAfter = 0;
});

describe('GET /api/appointments — 429 rate limit bloqueado (D2)', () => {
  it('status 429 + envelope exato sem retryAfter no body + header Retry-After', async () => {
    mockRateLimit.allowed = false;
    mockRateLimit.remaining = 0;
    mockRateLimit.retryAfter = 30;

    const res = await GET(makeGetRequest() as any);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(typeof body?.error?.requestId).toBe('string');
    expect(body).toEqual({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded',
        requestId: body.error.requestId,
      },
    });
    expect(body).not.toHaveProperty('retryAfter');
    expect(body.error).not.toHaveProperty('retryAfter');
    expect(res.headers.get('Retry-After')).toBe('30');
  });
});

describe('POST /api/appointments — 429 rate limit bloqueado (D2)', () => {
  it('status 429 + envelope exato sem retryAfter no body + header Retry-After', async () => {
    mockRateLimit.allowed = false;
    mockRateLimit.remaining = 0;
    mockRateLimit.retryAfter = 30;

    const res = await POST(makePostRequest() as any);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(typeof body?.error?.requestId).toBe('string');
    expect(body).toEqual({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded',
        requestId: body.error.requestId,
      },
    });
    expect(body).not.toHaveProperty('retryAfter');
    expect(body.error).not.toHaveProperty('retryAfter');
    expect(res.headers.get('Retry-After')).toBe('30');
  });
});
