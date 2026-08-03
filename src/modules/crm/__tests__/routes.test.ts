/**
 * routes.test.ts — Task 5 / Eixo 2 Integration Closure.
 *
 * Cobertura dos handlers CRM sob /api/contacts:
 *  - Todos os handlers gated por withModuleRoute('crm', moduleManifest)
 *    → 404 com {error:'not_found'} quando CRM desabilitado.
 *  - GET /api/contacts → crm.listarContatos
 *  - GET /api/contacts/[id]?type=... → crm.obterContato
 *  - GET /api/contacts/[id]/timeline?type=... → crm.listarTimelineContato
 *  - GET /api/contacts/[id]/notes?type=... → crm.listarNotasContato
 *  - POST /api/contacts/[id]/notes → crm.adicionarNotaContato
 *  - PUT /api/contacts/[id]/tags → crm.atualizarTagsContato
 *  - Duplicates routes: GET list, GET detail, POST approve/dismiss/merge
 *  - POST /api/contacts e PUT/PATCH /api/contacts/[id] → 405 crm_mvp_read_only
 *  - type inválido (não patient|lead) → 400 nos handlers que recebem type
 *
 * Sem imports legados validateApiAuth / getDb / services de contacts.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockBuildUserContext = jest.fn();
const mockModuleManifest = { isEnabled: jest.fn() };
const mockRunCrmAction = jest.fn();
const mockRunAction = jest.fn();

jest.mock('@/core/actions/run', () => ({
  runAction: (...args: unknown[]) => mockRunAction(...args),
}));

jest.mock('@/core/modules/manifest', () => ({
  moduleManifest: mockModuleManifest,
}));

jest.mock('@/core/modules/gates', () => ({
  withModuleRoute: jest.fn(
    (moduleId: string, manifest: { isEnabled: (id: string) => Promise<boolean> }) =>
      <H extends (...args: any[]) => Promise<Response>>(handler: H): H =>
        (async (...args: Parameters<H>) => {
          if (!(await manifest.isEnabled(moduleId))) {
            return new Response(JSON.stringify({ error: 'not_found' }), {
              status: 404,
              headers: { 'content-type': 'application/json' },
            });
          }
          return handler(...args);
        }) as H,
  ),
  ModuleDisabledError: class ModuleDisabledError extends Error {},
}));

jest.mock('@/core/actions/context', () => ({
  buildUserContext: (...args: unknown[]) => mockBuildUserContext(...args),
}));

jest.mock('@/modules/crm/ui/route-adapter', () => {
  const actual = jest.requireActual('@/modules/crm/ui/route-adapter');
  return {
    ...actual,
    runCrmAction: (...args: unknown[]) => mockRunCrmAction(...args),
    validateRequest: jest.fn().mockResolvedValue({
      ok: true as const,
      profile: { id: 'u1', clinic_id: 'c1', role: 'owner' },
    }),
  };
});

// Default behavior: CRM enabled, buildUserContext returns ctx, runCrmAction returns 200.
beforeEach(() => {
  jest.clearAllMocks();
  mockModuleManifest.isEnabled.mockResolvedValue(true);
  mockBuildUserContext.mockResolvedValue({
    source: 'user',
    clinicId: 'c1',
    user: { id: 'u1', email: 'u@t.com', name: 'U' },
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'u1' },
  });
  mockRunCrmAction.mockImplementation(async () =>
    new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  mockRunAction.mockImplementation(async () => ({
    ok: true,
    data: [],
  }));
});

import { NextRequest } from 'next/server';

// ─── Route imports (lazy to avoid module init order) ────────────────────────
const importRoute = async (path: string) => {
  // Use jest.requireActual with a re-evaluation strategy to load latest
  const mod = await import(/* webpackIgnore: true */ path);
  return mod;
};

const mkReq = (url = 'http://localhost/api/contacts', init?: RequestInit) =>
  new NextRequest(new Request(url, init));

const mkParams = <T>(p: T) => ({ params: Promise.resolve(p) });

// ─── Helper: status+json of a Response ───────────────────────────────────────
async function read(res: Response) {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/contacts — CRM disabled → 404', () => {
  it('404 quando CRM não habilitado', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(false);
    const { GET } = await importRoute('@/app/api/contacts/route');
    const r = await GET(mkReq('http://localhost/api/contacts'));
    const { status, body } = await read(r);
    expect(status).toBe(404);
    expect(body).toEqual({ error: 'not_found' });
    expect(mockRunCrmAction).not.toHaveBeenCalled();
  });
});

describe('POST /api/contacts — 405 crm_mvp_read_only', () => {
  it('sempre retorna 405 com {error:crm_mvp_read_only}', async () => {
    const { POST } = await importRoute('@/app/api/contacts/route');
    const r = await POST(
      mkReq('http://localhost/api/contacts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'patient', name: 'X', phone: '1' }),
      }),
    );
    const { status, body } = await read(r);
    expect(status).toBe(405);
    expect(body).toEqual({ error: 'crm_mvp_read_only' });
    expect(mockRunCrmAction).not.toHaveBeenCalled();
  });

  it('404 quando CRM disabled (module gate precede read-only)', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(false);
    const { POST } = await importRoute('@/app/api/contacts/route');
    const r = await POST(
      mkReq('http://localhost/api/contacts', { method: 'POST' }),
    );
    const { status, body } = await read(r);
    expect(status).toBe(404);
    expect(body).toEqual({ error: 'not_found' });
  });
});

describe('GET /api/contacts — CRM enabled → runCrmAction(listarContatos)', () => {
  it('passa search/limit/offset do querystring para a action', async () => {
    const { GET } = await importRoute('@/app/api/contacts/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts?search=Ana&limit=10&offset=0'),
    );
    expect(r.status).toBe(200);
    expect(mockRunCrmAction).toHaveBeenCalledTimes(1);
    const [action, input] = mockRunCrmAction.mock.calls[0];
    expect(action.name).toBe('crm.listarContatos');
    expect(input).toMatchObject({
      search: 'Ana',
      limit: 10,
      offset: 0,
    });
  });

  it('404 quando CRM disabled', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(false);
    const { GET } = await importRoute('@/app/api/contacts/route');
    const r = await GET(mkReq('http://localhost/api/contacts'));
    expect(r.status).toBe(404);
  });
});

describe('PUT /api/contacts/[id] — 405 crm_mvp_read_only', () => {
  it('PUT retorna 405 mesmo com CRM enabled', async () => {
    const { PUT } = await importRoute('@/app/api/contacts/[id]/route');
    const r = await PUT(
      mkReq('http://localhost/api/contacts/p1', {
        method: 'PUT',
        body: JSON.stringify({ type: 'patient', name: 'X' }),
      }),
      mkParams({ id: 'p1' }),
    );
    const { status, body } = await read(r);
    expect(status).toBe(405);
    expect(body).toEqual({ error: 'crm_mvp_read_only' });
    expect(mockRunCrmAction).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/contacts/[id] — 405 crm_mvp_read_only', () => {
  it('PATCH retorna 405', async () => {
    const { PATCH } = await importRoute('@/app/api/contacts/[id]/route');
    const r = await PATCH(
      mkReq('http://localhost/api/contacts/p1', {
        method: 'PATCH',
        body: JSON.stringify({ type: 'patient' }),
      }),
      mkParams({ id: 'p1' }),
    );
    const { status, body } = await read(r);
    expect(status).toBe(405);
    expect(body).toEqual({ error: 'crm_mvp_read_only' });
  });
});

describe('GET /api/contacts/[id] — type inválido → 400', () => {
  it('400 quando type não é patient|lead', async () => {
    const { GET } = await importRoute('@/app/api/contacts/[id]/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/p1?type=foo'),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(400);
    expect(mockRunCrmAction).not.toHaveBeenCalled();
  });

  it('400 quando type ausente', async () => {
    const { GET } = await importRoute('@/app/api/contacts/[id]/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/p1'),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(400);
  });
});

describe('GET /api/contacts/[id] — CRM enabled → runCrmAction(obterContato)', () => {
  it('passa type+id para obterContato', async () => {
    const { GET } = await importRoute('@/app/api/contacts/[id]/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/p1?type=patient'),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(200);
    expect(mockRunCrmAction).toHaveBeenCalledTimes(1);
    const [action, input] = mockRunCrmAction.mock.calls[0];
    expect(action.name).toBe('crm.obterContato');
    expect(input).toMatchObject({ type: 'patient', id: 'p1' });
  });

  it('404 quando CRM disabled', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(false);
    const { GET } = await importRoute('@/app/api/contacts/[id]/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/p1?type=patient'),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(404);
  });
});

describe('GET /api/contacts/[id]/timeline — CRM gated, action-driven', () => {
  it('400 quando type inválido', async () => {
    const { GET } = await importRoute('@/app/api/contacts/[id]/timeline/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/p1/timeline?type=invalid'),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(400);
    expect(mockRunCrmAction).not.toHaveBeenCalled();
  });

  it('runCrmAction(listarTimelineContato) com type=lead', async () => {
    const { GET } = await importRoute('@/app/api/contacts/[id]/timeline/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/l1/timeline?type=lead'),
      mkParams({ id: 'l1' }),
    );
    expect(r.status).toBe(200);
    const [action, input] = mockRunCrmAction.mock.calls[0];
    expect(action.name).toBe('crm.listarTimelineContato');
    expect(input).toMatchObject({ type: 'lead', id: 'l1' });
  });

  it('404 quando CRM disabled', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(false);
    const { GET } = await importRoute('@/app/api/contacts/[id]/timeline/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/p1/timeline?type=patient'),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(404);
  });
});

describe('GET /api/contacts/[id]/notes — CRM gated, action-driven', () => {
  it('400 quando type inválido', async () => {
    const { GET } = await importRoute('@/app/api/contacts/[id]/notes/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/p1/notes?type=foo'),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(400);
  });

  it('runCrmAction(listarNotasContato)', async () => {
    const { GET } = await importRoute('@/app/api/contacts/[id]/notes/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/p1/notes?type=patient'),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(200);
    const [action, input] = mockRunCrmAction.mock.calls[0];
    expect(action.name).toBe('crm.listarNotasContato');
    expect(input).toMatchObject({ type: 'patient', id: 'p1' });
  });

  it('404 quando CRM disabled', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(false);
    const { GET } = await importRoute('@/app/api/contacts/[id]/notes/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/p1/notes?type=patient'),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(404);
  });
});

describe('POST /api/contacts/[id]/notes — NÃO 405; chama adicionarNotaContato', () => {
  it('runCrmAction(adicionarNotaContato) com type+id+content', async () => {
    const { POST } = await importRoute('@/app/api/contacts/[id]/notes/route');
    const r = await POST(
      mkReq('http://localhost/api/contacts/p1/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'patient', content: 'nota' }),
      }),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(200);
    const [action, input] = mockRunCrmAction.mock.calls[0];
    expect(action.name).toBe('crm.adicionarNotaContato');
    expect(input).toMatchObject({ type: 'patient', id: 'p1', content: 'nota' });
    expect(r.status).not.toBe(405);
  });

  it('404 quando CRM disabled', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(false);
    const { POST } = await importRoute('@/app/api/contacts/[id]/notes/route');
    const r = await POST(
      mkReq('http://localhost/api/contacts/p1/notes', {
        method: 'POST',
        body: JSON.stringify({ type: 'patient', content: 'x' }),
      }),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(404);
  });

  it('400 quando body inválido (sem content)', async () => {
    const { POST } = await importRoute('@/app/api/contacts/[id]/notes/route');
    const r = await POST(
      mkReq('http://localhost/api/contacts/p1/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'patient' }),
      }),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(400);
  });
});

describe('PUT /api/contacts/[id]/tags — NÃO 405; chama atualizarTagsContato', () => {
  it('runCrmAction(atualizarTagsContato) com type+id+tags', async () => {
    const { PUT } = await importRoute('@/app/api/contacts/[id]/tags/route');
    const r = await PUT(
      mkReq('http://localhost/api/contacts/p1/tags', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'patient', tags: ['VIP'] }),
      }),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(200);
    const [action, input] = mockRunCrmAction.mock.calls[0];
    expect(action.name).toBe('crm.atualizarTagsContato');
    expect(input).toMatchObject({ type: 'patient', id: 'p1', tags: ['VIP'] });
    expect(r.status).not.toBe(405);
  });

  it('404 quando CRM disabled', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(false);
    const { PUT } = await importRoute('@/app/api/contacts/[id]/tags/route');
    const r = await PUT(
      mkReq('http://localhost/api/contacts/p1/tags', {
        method: 'PUT',
        body: JSON.stringify({ type: 'patient', tags: [] }),
      }),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(404);
  });
});

describe('GET /api/contacts/[id]/appointments — CRM gated, action-driven', () => {
  it('400 quando type inválido (não patient|lead)', async () => {
    const { GET } = await importRoute('@/app/api/contacts/[id]/appointments/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/p1/appointments?type=foo'),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(400);
  });

  it('404 quando CRM disabled', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(false);
    const { GET } = await importRoute('@/app/api/contacts/[id]/appointments/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/p1/appointments?type=patient'),
      mkParams({ id: 'p1' }),
    );
    expect(r.status).toBe(404);
  });
});

describe('GET /api/contacts/duplicates — CRM gated', () => {
  it('200 quando enabled → runCrmAction(listarSugestoesDuplicidade)', async () => {
    const { GET } = await importRoute('@/app/api/contacts/duplicates/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/duplicates?status=pending&owner_type=patient'),
    );
    expect(r.status).toBe(200);
    expect(mockRunCrmAction).toHaveBeenCalledTimes(1);
    const [action, input] = mockRunCrmAction.mock.calls[0];
    expect(action.name).toBe('crm.listarSugestoesDuplicidade');
    expect(input).toMatchObject({ status: 'pending', ownerType: 'patient' });
  });
});

describe('GET /api/contacts/duplicates/[id] — CRM gated, action-driven', () => {
  it('runCrmAction(obterSugestaoDuplicidade) com id', async () => {
    const { GET } = await importRoute('@/app/api/contacts/duplicates/[id]/route');
    const r = await GET(
      mkReq('http://localhost/api/contacts/duplicates/s1'),
      mkParams({ id: 's1' }),
    );
    expect(r.status).toBe(200);
    const [action, input] = mockRunCrmAction.mock.calls[0];
    expect(action.name).toBe('crm.obterSugestaoDuplicidade');
    expect(input).toMatchObject({ id: 's1' });
  });
});

describe('POST /api/contacts/duplicates/[id]/approve — CRM gated', () => {
  it('runCrmAction(aprovarSugestaoDuplicidade)', async () => {
    const { POST } = await importRoute(
      '@/app/api/contacts/duplicates/[id]/approve/route',
    );
    const r = await POST(
      mkReq('http://localhost/api/contacts/duplicates/s1/approve', { method: 'POST' }),
      mkParams({ id: 's1' }),
    );
    expect(r.status).toBe(200);
    const [action, input] = mockRunCrmAction.mock.calls[0];
    expect(action.name).toBe('crm.aprovarSugestaoDuplicidade');
    expect(input).toMatchObject({ id: 's1' });
  });
});

describe('POST /api/contacts/duplicates/[id]/dismiss — CRM gated', () => {
  it('runCrmAction(dispensarSugestaoDuplicidade)', async () => {
    const { POST } = await importRoute(
      '@/app/api/contacts/duplicates/[id]/dismiss/route',
    );
    const r = await POST(
      mkReq('http://localhost/api/contacts/duplicates/s1/dismiss', { method: 'POST' }),
      mkParams({ id: 's1' }),
    );
    expect(r.status).toBe(200);
    const [action, input] = mockRunCrmAction.mock.calls[0];
    expect(action.name).toBe('crm.dispensarSugestaoDuplicidade');
    expect(input).toMatchObject({ id: 's1' });
  });
});