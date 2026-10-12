/**
 * POST /api/cron/outbox — auth timing-safe antes de rate limit + 429 canônico.
 * Segue o padrão de cleanup/reminders (T1 DoS protection).
 */

const mockProcessOutboxBatch = jest.fn();
const mockGetConsumerRelease = jest.fn();
const mockGetOutboxControlStatus = jest.fn();
const mockRateLimit = { allowed: true, retryAfter: 0 };

jest.mock('@/lib/outbox/worker', () => ({
  outboxOperations: ['test-op'],
  processOutboxBatch: (...args: unknown[]) => mockProcessOutboxBatch(...args),
}));

jest.mock('@/lib/outbox/consumer-release', () => ({
  getConsumerRelease: (...args: unknown[]) => mockGetConsumerRelease(...args),
}));

jest.mock('@/lib/outbox/control', () => ({
  OutboxControlError: class OutboxControlError extends Error {
    code: string;
    constructor(code: string) { super(code); this.code = code; }
  },
  getOutboxControlStatus: (...args: unknown[]) => mockGetOutboxControlStatus(...args),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => mockRateLimit),
  rateLimitPresets: { cron: { windowMs: 60000, maxRequests: 20 } },
}));

import { POST, GET } from '@/app/api/cron/outbox/route';

function makeRequest(auth?: string, method = 'POST'): Request {
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers.Authorization = auth;
  return new Request('http://localhost/api/cron/outbox', { method, headers }) as any;
}

const VALID = 'Bearer test-cron-secret';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  mockRateLimit.allowed = true;
  mockRateLimit.retryAfter = 0;
  mockProcessOutboxBatch.mockResolvedValue([]);
  mockGetConsumerRelease.mockResolvedValue('3f5a1c2b-4d6e-7f80-9a1b-2c3d4e5f6a7b');
  mockGetOutboxControlStatus.mockResolvedValue({
    paused: true,
    epoch: 3,
    releaseId: null,
    counts: { processing: 0 },
    drained: true,
  });
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('POST /api/cron/outbox — auth gate', () => {
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

describe('POST /api/cron/outbox — rate limit', () => {
  it('credencial inválida não chama checkRateLimit', async () => {
    const { checkRateLimit } = jest.requireMock('@/lib/rate-limit') as { checkRateLimit: jest.Mock };
    checkRateLimit.mockClear();
    const res = await POST(makeRequest('Bearer wrong') as any);
    expect(res.status).toBe(401);
    expect(checkRateLimit).not.toHaveBeenCalled();
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
    expect(body.error).not.toHaveProperty('retryAfter');
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(mockProcessOutboxBatch).not.toHaveBeenCalled();
  });
});

describe('GET /api/cron/outbox — liveness sem limiter', () => {
  it('não chama checkRateLimit', async () => {
    const { checkRateLimit } = jest.requireMock('@/lib/rate-limit') as { checkRateLimit: jest.Mock };
    checkRateLimit.mockClear();
    const res = await GET(makeRequest(VALID, 'GET') as any);
    expect(res.status).toBe(200);
    expect(checkRateLimit).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body).toMatchObject({ status: 'paused', releaseId: '3f5a1c2b-4d6e-7f80-9a1b-2c3d4e5f6a7b', controlEpoch: 3, processing: 0, drained: true });
    expect(JSON.stringify(body)).not.toMatch(/secret|password|payload|phone/i);
  });

  it('não aprova versão desconhecida e não expõe erro do driver', async () => {
    mockGetConsumerRelease.mockResolvedValue(null);
    const res = await GET(makeRequest(VALID, 'GET') as any);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'unavailable', reason: 'outbox-release-unknown' });

    mockGetConsumerRelease.mockResolvedValue('3f5a1c2b-4d6e-7f80-9a1b-2c3d4e5f6a7b');
    mockGetOutboxControlStatus.mockRejectedValue(new Error('postgres://secret-password/private-db'));
    const unavailable = await GET(makeRequest(VALID, 'GET') as any);
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ status: 'unavailable', reason: 'OUTBOX_CONTROL_UNAVAILABLE' });
  });
});
