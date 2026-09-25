/**
 * POST /api/cron/hot-leads — auth timing-safe antes de rate limit + 429
 * canônico (padrão cleanup.ts).
 */

const mockAssertModuleForJob = jest.fn();
const mockRateLimit = { allowed: true, retryAfter: 0 };

jest.mock('@/core/modules/gates', () => ({
  assertModuleForJob: (...args: unknown[]) => mockAssertModuleForJob(...args),
}));

jest.mock('@/core/modules/manifest', () => ({
  createManifest: () => ({}),
}));

jest.mock('@/lib/db/client', () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
  }),
}));

jest.mock('@/lib/db/schema/core', () => ({
  clinics: { id: 'id', deletedAt: 'deletedAt' },
}));

jest.mock('@/modules/comercial', () => ({
  processarNotificacoesLeadsQuentes: { name: 'comercial.processarNotificacoesLeadsQuentes' },
}));

jest.mock('@/core/actions/run', () => ({
  runAction: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => mockRateLimit),
  rateLimitPresets: { cron: { windowMs: 60000, maxRequests: 20 } },
}));

import { POST } from './route';

function makeRequest(auth?: string): Request {
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers.Authorization = auth;
  return new Request('http://localhost/api/cron/hot-leads', { method: 'POST', headers }) as any;
}

const VALID = 'Bearer test-cron-secret';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  mockRateLimit.allowed = true;
  mockRateLimit.retryAfter = 0;
  mockAssertModuleForJob.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('POST /api/cron/hot-leads — auth gate', () => {
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

describe('POST /api/cron/hot-leads — rate limit', () => {
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
  });
});
