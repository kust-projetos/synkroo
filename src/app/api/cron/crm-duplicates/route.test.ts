/**
 * route.test.ts — POST /api/cron/crm-duplicates
 *
 * Task 4 / Eixo 2 Integration Closure:
 *  - Bearer CRON_SECRET via timingSafeEqual → 401 quando inválido.
 *  - assertModuleForJob('crm', moduleManifest) lança ModuleDisabledError →
 *    responder { skipped: true } com 200.
 *  - Para cada clinicId retornado por listClinicIdsWithPendingSuggestions:
 *    construir system context, chamar runAction(reprocessarSugestoesDuplicidade).
 *  - Erros por clinic são logados e o loop continua.
 *  - Sem clinics pendentes → { processed: 0, results: [] }.
 */

const mockListClinicIds = jest.fn();
const mockBuildSystemContext = jest.fn();
const mockRunAction = jest.fn();
const mockModuleManifest = { isEnabled: jest.fn() };
const mockAssertModuleForJob = jest.fn();
const mockRateLimit = { allowed: true, retryAfter: 0 };

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => mockRateLimit),
  rateLimitPresets: { cron: { windowMs: 60000, maxRequests: 60 } },
}));

jest.mock('@/modules/crm/repositories/duplicate-suggestions-repository', () => ({
  listClinicIdsWithPendingSuggestions: (...args: unknown[]) =>
    mockListClinicIds(...args),
}));

jest.mock('@/core/actions/context', () => ({
  buildSystemContext: (...args: unknown[]) => mockBuildSystemContext(...args),
}));

jest.mock('@/core/actions/run', () => ({
  runAction: (...args: unknown[]) => mockRunAction(...args),
}));

jest.mock('@/core/modules/gates', () => ({
  assertModuleForJob: (...args: unknown[]) => mockAssertModuleForJob(...args),
  ModuleDisabledError: class ModuleDisabledError extends Error {
    constructor(public moduleId: string) {
      super(`module disabled: ${moduleId}`);
    }
  },
}));

jest.mock('@/core/modules/manifest', () => ({
  moduleManifest: mockModuleManifest,
}));

// Real action import (sem register side-effect relevante para os testes).
jest.mock('@/modules/crm/actions', () => ({
  reprocessarSugestoesDuplicidade: {
    name: 'crm.reprocessarSugestoesDuplicidade',
    module: 'crm',
    requires: 'system',
    label: 'Reprocessar sugestões de duplicidade',
  },
}));

import { POST } from './route';

function makeRequest(authorization?: string): Request {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.Authorization = authorization;
  return new Request('http://localhost/api/cron/crm-duplicates', {
    method: 'POST',
    headers,
  });
}

const VALID_BEARER = 'Bearer test-cron-secret';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  mockRateLimit.allowed = true;
  mockModuleManifest.isEnabled.mockResolvedValue(true);
  mockAssertModuleForJob.mockResolvedValue(undefined);
  mockBuildSystemContext.mockResolvedValue({
    source: 'system',
    clinicId: 'c1',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'cron:crm-duplicates' },
  });
  mockRunAction.mockResolvedValue({ ok: true, data: { evaluated: 0, dismissed: 0 } });
  mockListClinicIds.mockResolvedValue([]);
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('POST /api/cron/crm-duplicates — security gate', () => {
  it('401 sem Authorization header', async () => {
    const res = await POST(makeRequest() as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('401 com Authorization sem prefixo Bearer', async () => {
    const res = await POST(makeRequest('Basic test-cron-secret') as any);
    expect(res.status).toBe(401);
  });

  it('401 com secret diferente (timingSafeEqual mismatch)', async () => {
    const res = await POST(makeRequest('Bearer wrong-secret') as any);
    expect(res.status).toBe(401);
  });

  it('401 quando CRON_SECRET não está definido em env', async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(makeRequest(VALID_BEARER) as any);
    expect(res.status).toBe(401);
  });

  it('401 quando Authorization é vazio', async () => {
    const res = await POST(makeRequest('') as any);
    expect(res.status).toBe(401);
  });

  it('200 quando CRON_SECRET válido', async () => {
    const res = await POST(makeRequest(VALID_BEARER) as any);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/cron/crm-duplicates — module gate', () => {
  it('retorna { skipped: true } quando CRM está desabilitado', async () => {
    const { ModuleDisabledError } = jest.requireMock('@/core/modules/gates') as {
      ModuleDisabledError: new (moduleId: string) => Error;
    };
    mockAssertModuleForJob.mockRejectedValueOnce(
      new ModuleDisabledError('crm'),
    );
    const res = await POST(makeRequest(VALID_BEARER) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ skipped: true });
  });

  it('moduleManifest.isEnabled é consultado via assertModuleForJob("crm", ...)', async () => {
    await POST(makeRequest(VALID_BEARER) as any);
    expect(mockAssertModuleForJob).toHaveBeenCalledWith('crm', mockModuleManifest);
  });
});

describe('POST /api/cron/crm-duplicates — sem clinics pendentes', () => {
  it('zero clinics → { processed: 0, results: [] }', async () => {
    mockListClinicIds.mockResolvedValue([]);
    const res = await POST(makeRequest(VALID_BEARER) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(0);
    expect(body.results).toEqual([]);
    expect(mockBuildSystemContext).not.toHaveBeenCalled();
    expect(mockRunAction).not.toHaveBeenCalled();
  });
});

describe('POST /api/cron/crm-duplicates — execução per-clinic', () => {
  it('uma clinic: buildSystemContext + runAction com action+input {clinicId}', async () => {
    mockListClinicIds.mockResolvedValue(['c-aaaa']);
    const res = await POST(makeRequest(VALID_BEARER) as any);
    expect(res.status).toBe(200);
    expect(mockBuildSystemContext).toHaveBeenCalledWith('c-aaaa');
    expect(mockRunAction).toHaveBeenCalledTimes(1);
    const [action, input] = mockRunAction.mock.calls[0];
    expect(action.name).toBe('crm.reprocessarSugestoesDuplicidade');
    expect(input).toEqual({ clinicId: 'c-aaaa' });
    const body = await res.json();
    expect(body.processed).toBe(1);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({ clinicId: 'c-aaaa', ok: true });
  });

  it('múltiplas clinics: loop sequencial e total bate', async () => {
    mockListClinicIds.mockResolvedValue(['c-1', 'c-2', 'c-3']);
    mockRunAction.mockResolvedValue({ ok: true, data: { evaluated: 0, dismissed: 0 } });
    const res = await POST(makeRequest(VALID_BEARER) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(3);
    expect(body.results).toHaveLength(3);
    expect(body.results.map((r: any) => r.clinicId)).toEqual(['c-1', 'c-2', 'c-3']);
    expect(mockBuildSystemContext).toHaveBeenCalledTimes(3);
    expect(mockRunAction).toHaveBeenCalledTimes(3);
  });

  it('erro em uma clinic NÃO aborta o processamento das outras', async () => {
    mockListClinicIds.mockResolvedValue(['c-1', 'c-2', 'c-3']);
    mockRunAction
      .mockResolvedValueOnce({ ok: true, data: { evaluated: 1, dismissed: 0 } })
      .mockImplementationOnce(() => { throw new Error('boom c-2'); })
      .mockResolvedValueOnce({ ok: true, data: { evaluated: 0, dismissed: 0 } });

    const res = await POST(makeRequest(VALID_BEARER) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(3);
    expect(body.results[0]).toMatchObject({ clinicId: 'c-1', ok: true });
    expect(body.results[1]).toMatchObject({ clinicId: 'c-2', ok: false });
    expect(body.results[1].error).toBeDefined();
    expect(body.results[2]).toMatchObject({ clinicId: 'c-3', ok: true });
  });

  it('runAction retornando { ok: false } é registrado mas NÃO interrompe o loop', async () => {
    mockListClinicIds.mockResolvedValue(['c-1', 'c-2']);
    mockRunAction
      .mockResolvedValueOnce({ ok: false, error: { code: 'module_disabled', message: 'x' } })
      .mockResolvedValueOnce({ ok: true, data: { evaluated: 0, dismissed: 0 } });
    const res = await POST(makeRequest(VALID_BEARER) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ clinicId: 'c-1', ok: false });
    expect(body.results[1]).toMatchObject({ clinicId: 'c-2', ok: true });
    expect(body.processed).toBe(2);
  });
});

describe('POST /api/cron/crm-duplicates — rate limit', () => {
  it('429 quando rate limit excedido', async () => {
    mockRateLimit.allowed = false;
    mockRateLimit.retryAfter = 30;
    const res = await POST(makeRequest(VALID_BEARER) as any);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'Rate limit exceeded', retryAfter: 30 });
  });
});