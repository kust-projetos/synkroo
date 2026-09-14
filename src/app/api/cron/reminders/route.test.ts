/**
 * T1 — POST /api/cron/reminders DoS protection
 * Verifica auth timing-safe antes de rate limit e 20 anon + valid not 429
 */

const mockProcessAllReminders = jest.fn();
const mockAssertModuleForJob = jest.fn();
const mockRateLimit = { allowed: true, retryAfter: 0 };

jest.mock('@/modules/operacional/services/reminders-service', () => ({
  processAllReminders: (...args: unknown[]) => mockProcessAllReminders(...args),
}));

jest.mock('@/core/modules/gates', () => ({
  assertModuleForJob: (...args: unknown[]) => mockAssertModuleForJob(...args),
}));

jest.mock('@/core/modules/manifest', () => ({
  createManifest: () => ({}),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => mockRateLimit),
  rateLimitPresets: { cron: { windowMs: 60000, maxRequests: 20 } },
}));

import { POST } from './route';

function makeRequest(auth?: string): Request {
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers.Authorization = auth;
  return new Request('http://localhost/api/cron/reminders', { method: 'POST', headers });
}

const VALID = 'Bearer test-cron-secret';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  mockRateLimit.allowed = true;
  mockAssertModuleForJob.mockResolvedValue(undefined);
  mockProcessAllReminders.mockResolvedValue({ processed: 1, errors: 0 });
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('POST /api/cron/reminders — auth gate', () => {
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

describe('POST /api/cron/reminders — T1 DoS protection', () => {
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

  it('429 quando rate limit excedido com credencial válida: envelope exato sem retryAfter no body + header Retry-After', async () => {
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
    expect(body.error).not.toHaveProperty('retryAfter');
    expect(res.headers.get('Retry-After')).toBe('30');
  });
});
