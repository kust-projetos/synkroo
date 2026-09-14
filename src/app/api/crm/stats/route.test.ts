/**
 * Contrato — GET /api/crm/stats branch 429 (Fatia B)
 *
 * O handler (`src/services/api-handlers/crm/stats.ts:24-28`) responde ao
 * rate limit bloqueado com o body canônico SEM `retryAfter` e o backoff
 * apenas no header `Retry-After`. Esta suíte ancora esse contrato.
 */

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

const mockValidateApiAuth = jest.fn();

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: (...args: unknown[]) => mockValidateApiAuth(...args),
}));

import { GET } from './route';

function makeRequest(): Request {
  return new Request('http://localhost/api/crm/stats', { method: 'GET' }) as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRateLimit.allowed = true;
  mockRateLimit.remaining = 60;
  mockRateLimit.retryAfter = 0;
  mockValidateApiAuth.mockResolvedValue({
    success: true,
    profile: { clinic_id: 'clinic-1' },
  });
});

describe('GET /api/crm/stats — 429 rate limit bloqueado (Fatia B)', () => {
  it('status 429 + envelope exato sem retryAfter no body + header Retry-After', async () => {
    mockRateLimit.allowed = false;
    mockRateLimit.remaining = 0;
    mockRateLimit.retryAfter = 30;

    const res = await GET(makeRequest() as any);

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
    expect(mockValidateApiAuth).not.toHaveBeenCalled();
  });
});

describe('GET /api/crm/stats — envelope de falha de auth', () => {
  it('401 UNAUTHORIZED em envelope canônico quando não autenticado', async () => {
    mockValidateApiAuth.mockResolvedValue({
      success: false,
      error: { message: 'Unauthorized', status: 401 },
    });

    const res = await GET(makeRequest() as any);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(typeof body?.error?.requestId).toBe('string');
    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
        requestId: body.error.requestId,
      },
    });
  });
});
