/**
 * [...nextauth] — POST gated com preset generoso (api 60/min/IP), GET sem limiter.
 */

const mockHandler = jest.fn();
const mockCheckRateLimit = jest.fn();

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(() => mockHandler),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIdentifier: () => 'test-client',
  rateLimitPresets: { api: { windowMs: 60_000, maxRequests: 60 } },
}));

import { NextRequest } from 'next/server';
import { GET, POST } from './route';

function makeRequest(method: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/session', { method });
}

const CTX = { params: Promise.resolve({ nextauth: ['session'] }) } as unknown as { params: Promise<{ nextauth: string[] }> };

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 59, resetTime: Date.now() + 60_000 });
  mockHandler.mockResolvedValue(new Response('ok', { status: 200 }));
});

describe('[...nextauth] rate limit', () => {
  it('GET não chama checkRateLimit (session polling sem limiter)', async () => {
    const res = await (GET as unknown as (req: NextRequest) => Promise<Response>)(makeRequest('GET'));
    expect(res.status).toBe(200);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('POST delega ao handler quando dentro do limite', async () => {
    const res = await POST(makeRequest('POST'), CTX);
    expect(res.status).toBe(200);
    expect(mockCheckRateLimit).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('POST retorna 429 com Retry-After quando o bucket estoura, sem chamar o handler', async () => {
    mockCheckRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000, retryAfter: 45 });
    const res = await POST(makeRequest('POST'), CTX);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('45');
    const body = await res.json();
    expect(body).toEqual({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: expect.any(String),
        requestId: body.error.requestId,
      },
    });
    expect(body).not.toHaveProperty('retryAfter');
    expect(body.error).not.toHaveProperty('retryAfter');
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('preset tolera ao menos 30 req/min/IP', async () => {
    const { rateLimitPresets } = jest.requireMock('@/lib/rate-limit') as {
      rateLimitPresets: { api: { maxRequests: number } };
    };
    expect(rateLimitPresets.api.maxRequests).toBeGreaterThanOrEqual(30);
  });
});
