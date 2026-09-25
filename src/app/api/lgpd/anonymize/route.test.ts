/**
 * POST /api/lgpd/anonymize — auth-before-limiter + 429 canônico.
 * Segue o padrão de lgpd/export (limiter após buildUserContext, bucket por IP).
 */

import { POST } from './route';
import { buildUserContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';

jest.mock('@/core/actions/context', () => ({ buildUserContext: jest.fn() }));
jest.mock('@/core/actions/run', () => ({ runAction: jest.fn() }));
jest.mock('@/modules/operacional', () => ({
  anonimizarPaciente: { name: 'operacional.anonimizarPaciente' },
}));

const mockCheckRateLimit = jest.fn();
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIdentifier: () => 'test-client',
  rateLimitPresets: { api: { windowMs: 60_000, maxRequests: 60 } },
}));

const PATIENT_ID = '00000000-0000-4000-8000-000000000001';

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

describe('POST /api/lgpd/anonymize', () => {
  it('returns 401 when not authenticated', async () => {
    (buildUserContext as jest.Mock).mockRejectedValue(new Error('unauthenticated'));
    const res = await POST(mockRequest({ patientId: PATIENT_ID }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when patientId is missing or malformed', async () => {
    const res = await POST(mockRequest({}));
    expect(res.status).toBe(400);
    expect(runAction).not.toHaveBeenCalled();
  });

  it('anonymizes with the canonical envelope', async () => {
    (runAction as jest.Mock).mockResolvedValue({ ok: true, data: { patientId: PATIENT_ID, anonymized: true } });
    const res = await POST(mockRequest({ patientId: PATIENT_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.anonymized).toBe(true);
  });

  it('returns 429 with Retry-After when the bucket is exhausted (auth before limiter)', async () => {
    mockCheckRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000, retryAfter: 15 });
    const res = await POST(mockRequest({ patientId: PATIENT_ID }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('15');
    const body = await res.json();
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(body).not.toHaveProperty('retryAfter');
    expect(body.error).not.toHaveProperty('retryAfter');
    expect(runAction).not.toHaveBeenCalled();
  });

  it('does not consume quota when unauthenticated (limiter after auth)', async () => {
    (buildUserContext as jest.Mock).mockRejectedValueOnce(new Error('unauthenticated'));
    mockCheckRateLimit.mockClear();
    const res = await POST(mockRequest({ patientId: PATIENT_ID }));
    expect(res.status).toBe(401);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });
});
