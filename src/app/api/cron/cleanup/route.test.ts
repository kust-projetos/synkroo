/**
 * T1 — POST /api/cron/cleanup DoS protection
 */

const mockDelete = jest.fn().mockReturnThis();
const mockWhere = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/db/client', () => ({
  getDb: () => ({
    delete: jest.fn(() => ({ where: mockWhere })),
  }),
}));

jest.mock('@/lib/db/schema', () => ({
  appointmentReminders: { createdAt: 'createdAt' },
  conversationStates: { updatedAt: 'updatedAt' },
  conversationSessions: { lastActivityAt: 'lastActivityAt' },
  waitlist: { createdAt: 'createdAt' },
}));

const mockRateLimit = { allowed: true, retryAfter: 0 };
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => mockRateLimit),
  rateLimitPresets: { cron: { windowMs: 60000, maxRequests: 20 } },
}));

import { POST } from './route';

function makeRequest(auth?: string): Request {
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers.Authorization = auth;
  return new Request('http://localhost/api/cron/cleanup', { method: 'POST', headers }) as any;
}

const VALID = 'Bearer test-cron-secret';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  mockRateLimit.allowed = true;
  mockWhere.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('POST /api/cron/cleanup — auth gate', () => {
  it('401 sem Authorization', async () => {
    const res = await POST(makeRequest() as any);
    expect(res.status).toBe(401);
  });
  it('401 com secret errado', async () => {
    const res = await POST(makeRequest('Bearer wrong') as any);
    expect(res.status).toBe(401);
  });
  it('200 com secret válido', async () => {
    const res = await POST(makeRequest(VALID) as any);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/cron/cleanup — T1 DoS protection', () => {
  it('credencial inválida não chama checkRateLimit', async () => {
    const { checkRateLimit } = jest.requireMock('@/lib/rate-limit') as { checkRateLimit: jest.Mock };
    checkRateLimit.mockClear();
    const res = await POST(makeRequest('Bearer wrong') as any);
    expect(res.status).toBe(401);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('20 anônimas 401 e seguinte válida não recebe 429', async () => {
    const { checkRateLimit } = jest.requireMock('@/lib/rate-limit') as { checkRateLimit: jest.Mock };
    checkRateLimit.mockClear();
    mockRateLimit.allowed = true;
    for (let i = 0; i < 20; i++) {
      const res = await POST(makeRequest() as any);
      expect(res.status).toBe(401);
    }
    expect(checkRateLimit).not.toHaveBeenCalled();
    const valid = await POST(makeRequest(VALID) as any);
    expect(valid.status).toBe(200);
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
  });

  it('429 com rate limit bloqueado: envelope exato sem retryAfter no body + header Retry-After', async () => {
    mockRateLimit.allowed = false;
    mockRateLimit.retryAfter = 30;
    const res = await POST(makeRequest(VALID) as any);
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
    expect(res.headers.get('Retry-After')).toBe('30');
  });
});
