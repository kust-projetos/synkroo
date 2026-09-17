import { POST } from '@/app/api/lgpd/export/route';
import { buildUserContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';

jest.mock('@/core/actions/context', () => ({ buildUserContext: jest.fn() }));
jest.mock('@/core/actions/run', () => ({ runAction: jest.fn() }));
jest.mock('@/modules/operacional/actions/exportar-dados-paciente', () => ({
  exportarDadosPaciente: { name: 'operacional.exportarDadosPaciente' },
}));

const mockCheckRateLimit = jest.fn();
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  rateLimitPresets: { api: { windowMs: 60_000, maxRequests: 60 } },
}));

function mockRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return {
    json: () => Promise.resolve(body),
    headers: { get: (key: string) => headers[key] ?? null },
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  (buildUserContext as jest.Mock).mockResolvedValue({
    source: 'user', clinicId: 'c1', user: { id: 'u1', email: 'u@example.com', name: 'User' },
    can: () => true, hasModule: () => true, audit: { actor: 'u1' },
  });
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 59, resetTime: Date.now() + 60_000 });
});

describe('POST /api/lgpd/export', () => {
  it('returns 401 when not authenticated', async () => {
    (buildUserContext as jest.Mock).mockRejectedValue(new Error('unauthenticated'));
    const res = await POST(mockRequest({ patientId: '00000000-0000-4000-8000-000000000001' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when patientId is missing or malformed', async () => {
    const res = await POST(mockRequest({}));
    expect(res.status).toBe(400);
    expect(runAction).not.toHaveBeenCalled();
  });

  it('returns the complete action export using the canonical envelope', async () => {
    (runAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { patient: { id: '00000000-0000-4000-8000-000000000001' }, consents: [] },
    });
    const res = await POST(mockRequest({ patientId: '00000000-0000-4000-8000-000000000001' }, { 'x-request-id': 'req-test' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('req-test');
    const body = await res.json();
    expect(body.data.patient).toBeDefined();
    expect(body.data.consents).toEqual([]);
  });

  it('does not expose a foreign patient', async () => {
    (runAction as jest.Mock).mockResolvedValue({ ok: false, error: { code: 'not_found', message: 'Paciente não encontrado.' } });
    const res = await POST(mockRequest({ patientId: '00000000-0000-4000-8000-000000000002' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_FOUND');
  });

  it('returns 429 with Retry-After when the per-user bucket is exhausted (auth before limiter)', async () => {
    mockCheckRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000, retryAfter: 15 });
    const res = await POST(mockRequest({ patientId: '00000000-0000-4000-8000-000000000001' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('15');
    expect((await res.json()).error.code).toBe('TOO_MANY_REQUESTS');
    expect(runAction).not.toHaveBeenCalled();
  });

  it('does not consume quota when unauthenticated (limiter after auth)', async () => {
    (buildUserContext as jest.Mock).mockRejectedValueOnce(new Error('unauthenticated'));
    mockCheckRateLimit.mockClear();
    const res = await POST(mockRequest({ patientId: '00000000-0000-4000-8000-000000000001' }));
    expect(res.status).toBe(401);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });
});
