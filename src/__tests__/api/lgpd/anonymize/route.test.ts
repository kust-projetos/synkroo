import { POST } from '@/app/api/lgpd/anonymize/route';
import { buildUserContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';

jest.mock('@/core/actions/context', () => ({ buildUserContext: jest.fn() }));
jest.mock('@/core/actions/run', () => ({ runAction: jest.fn() }));
jest.mock('@/modules/operacional/actions/anonimizar-paciente', () => ({
  anonimizarPaciente: { name: 'operacional.anonimizarPaciente' },
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
});

describe('POST /api/lgpd/anonymize', () => {
  it('returns 401 when not authenticated', async () => {
    (buildUserContext as jest.Mock).mockRejectedValue(new Error('unauthenticated'));
    const res = await POST(mockRequest({ patientId: '00000000-0000-4000-8000-000000000001' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when patientId is missing', async () => {
    const res = await POST(mockRequest({}));
    expect(res.status).toBe(400);
    expect(runAction).not.toHaveBeenCalled();
  });

  it('returns the action result and request id', async () => {
    (runAction as jest.Mock).mockResolvedValue({ ok: true, data: { anonymized: true, auditId: 'audit-1' } });
    const res = await POST(mockRequest(
      { patientId: '00000000-0000-4000-8000-000000000001' },
      { 'x-request-id': 'req-test' },
    ));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('req-test');
    const body = await res.json();
    expect(body.data.anonymized).toBe(true);
    expect(body.data.auditId).toBe('audit-1');
  });

  it('maps legal hold to a conflict without inventing a success', async () => {
    (runAction as jest.Mock).mockResolvedValue({ ok: false, error: { code: 'conflict', message: 'Paciente em legal hold.' } });
    const res = await POST(mockRequest({ patientId: '00000000-0000-4000-8000-000000000001' }));
    expect(res.status).toBe(423);
  });

  it('maps internal action failures to 500', async () => {
    (runAction as jest.Mock).mockResolvedValue({ ok: false, error: { code: 'internal', message: 'Erro interno.' } });
    const res = await POST(mockRequest({ patientId: '00000000-0000-4000-8000-000000000001' }));
    expect(res.status).toBe(500);
  });
});
