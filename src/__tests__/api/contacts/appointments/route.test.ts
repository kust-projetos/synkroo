/**
 * route.test.ts — GET /api/contacts/[id]/appointments
 *
 * Task 5 / Eixo 2 Integration Closure:
 *  - CRM gated (404 when module disabled).
 *  - Apenas 'patient' suportado. lead/operacional/outros → 404 (no leak).
 *  - Chama crm.listarContatos? Não — usa action operacional.listarConsultas
 *    via runCrmAction com patientId + page:1 + limit:50 enforced.
 *  - Sem imports legados validateApiAuth / getDb / drizzle.
 */

const mockBuildUserContext = jest.fn();
const mockModuleManifest = { isEnabled: jest.fn() };
const mockRunCrmAction = jest.fn();

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
  };
});

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
    new Response(JSON.stringify({ appointments: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
});

import { NextRequest } from 'next/server';

async function read(res: Response) {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

describe('GET /api/contacts/[id]/appointments — CRM gated', () => {
  it('404 quando CRM desabilitado', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(false);
    const { GET } = await import(
      '@/app/api/contacts/[id]/appointments/route'
    );
    const r = await GET(
      new NextRequest(
        new Request('http://localhost/api/contacts/p1/appointments'),
      ),
      { params: Promise.resolve({ id: 'p1' }) },
    );
    expect(r.status).toBe(404);
    expect(mockRunCrmAction).not.toHaveBeenCalled();
  });
});

describe('GET /api/contacts/[id]/appointments — type validation', () => {
  it('400 quando type inválido', async () => {
    const { GET } = await import(
      '@/app/api/contacts/[id]/appointments/route'
    );
    const r = await GET(
      new NextRequest(
        new Request(
          'http://localhost/api/contacts/p1/appointments?type=foo',
        ),
      ),
      { params: Promise.resolve({ id: 'p1' }) },
    );
    const { status } = await read(r);
    expect(status).toBe(400);
    expect(mockRunCrmAction).not.toHaveBeenCalled();
  });

  it('400 quando type ausente', async () => {
    const { GET } = await import(
      '@/app/api/contacts/[id]/appointments/route'
    );
    const r = await GET(
      new NextRequest(
        new Request('http://localhost/api/contacts/p1/appointments'),
      ),
      { params: Promise.resolve({ id: 'p1' }) },
    );
    expect(r.status).toBe(400);
  });
});

describe('GET /api/contacts/[id]/appointments — patient only (no leak)', () => {
  it('lead → 404 sem chamar action', async () => {
    const { GET } = await import(
      '@/app/api/contacts/[id]/appointments/route'
    );
    const r = await GET(
      new NextRequest(
        new Request(
          'http://localhost/api/contacts/l1/appointments?type=lead',
        ),
      ),
      { params: Promise.resolve({ id: 'l1' }) },
    );
    expect(r.status).toBe(404);
    expect(mockRunCrmAction).not.toHaveBeenCalled();
  });

  it('operacional → 404 sem chamar action', async () => {
    const { GET } = await import(
      '@/app/api/contacts/[id]/appointments/route'
    );
    const r = await GET(
      new NextRequest(
        new Request(
          'http://localhost/api/contacts/x1/appointments?type=operacional',
        ),
      ),
      { params: Promise.resolve({ id: 'x1' }) },
    );
    expect(r.status).toBe(404);
    expect(mockRunCrmAction).not.toHaveBeenCalled();
  });
});

describe('GET /api/contacts/[id]/appointments — patient → listarConsultas page=1 limit=50', () => {
  it('chama runCrmAction com action operacional.listarConsultas, page=1, limit=50', async () => {
    const { GET } = await import(
      '@/app/api/contacts/[id]/appointments/route'
    );
    const r = await GET(
      new NextRequest(
        new Request(
          'http://localhost/api/contacts/p1/appointments?type=patient',
        ),
      ),
      { params: Promise.resolve({ id: 'p1' }) },
    );
    expect(r.status).toBe(200);
    expect(mockRunCrmAction).toHaveBeenCalledTimes(1);
    const [action, input] = mockRunCrmAction.mock.calls[0];
    expect(action.name).toBe('operacional.listarConsultas');
    expect(action.module).toBe('operacional');
    expect(input).toMatchObject({
      patientId: 'p1',
      page: 1,
      limit: 50,
    });
  });

  it('forward body da action como resposta', async () => {
    mockRunCrmAction.mockImplementationOnce(async () =>
      new Response(
        JSON.stringify({
          appointments: [{ id: 'a1', scheduledAt: '2026-01-01' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const { GET } = await import(
      '@/app/api/contacts/[id]/appointments/route'
    );
    const r = await GET(
      new NextRequest(
        new Request(
          'http://localhost/api/contacts/p1/appointments?type=patient',
        ),
      ),
      { params: Promise.resolve({ id: 'p1' }) },
    );
    const { status, body } = await read(r);
    expect(status).toBe(200);
    expect(body.appointments).toHaveLength(1);
  });
});