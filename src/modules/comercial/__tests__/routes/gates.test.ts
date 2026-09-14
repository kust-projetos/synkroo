/**
 * Tests: Comercial route gates (Task 4).
 *
 * Tests that withModuleRoute returns 404 when module is disabled.
 * Full action execution flow is tested separately.
 */

import { NextRequest } from 'next/server';

const mockIsEnabled = jest.fn().mockResolvedValue(true);
jest.mock('@/core/modules/manifest', () => ({
  createManifest: () => ({
      isEnabled: mockIsEnabled, enabledModules: jest.fn() }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/core/actions/context', () => ({
  buildUserContext: jest.fn().mockResolvedValue({
    clinicId: 'clinic-123',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'test' },
  }),
}));

jest.mock('@/modules/comercial/actions/capturar-lead', () => ({
  capturarLead: { name: 'comercial.capturarLead', module: 'comercial', requires: 'comercial:capture_leads', label: 'Capturar lead', input: {} as any, handler: jest.fn() },
}));
jest.mock('@/modules/comercial/actions/listar-leads', () => ({
  listarLeads: { name: 'comercial.listarLeads', module: 'comercial', requires: 'comercial:view', label: 'Listar leads', input: {} as any, handler: jest.fn() },
}));
jest.mock('@/modules/comercial/actions/obter-lead', () => ({
  obterLead: { name: 'comercial.obterLead', module: 'comercial', requires: 'comercial:view', label: 'Obter lead', input: {} as any, handler: jest.fn() },
}));
jest.mock('@/modules/comercial/actions/atualizar-lead', () => ({
  atualizarLead: { name: 'comercial.atualizarLead', module: 'comercial', requires: 'comercial:edit_leads', label: 'Atualizar lead', input: {} as any, handler: jest.fn() },
}));
jest.mock('@/modules/comercial/actions/converter-lead', () => ({
  converterLead: { name: 'comercial.converterLead', module: 'comercial', requires: 'comercial:edit_leads', label: 'Converter lead', input: {} as any, handler: jest.fn() },
}));
jest.mock('@/modules/comercial/actions/mover-lead-etapa', () => ({
  moverLeadEtapaAction: { name: 'comercial.moverLeadEtapa', module: 'comercial', requires: 'comercial:manage_pipeline', label: 'Mover lead etapa', input: {} as any, handler: jest.fn() },
}));
jest.mock('@/modules/comercial/actions/listar-pipeline', () => ({
  listarPipeline: { name: 'comercial.listarPipeline', module: 'comercial', requires: 'comercial:view', label: 'Listar pipeline', input: {} as any, handler: jest.fn() },
}));
jest.mock('@/modules/comercial/actions/criar-etapa-pipeline', () => ({
  criarEtapaPipeline: { name: 'comercial.criarEtapaPipeline', module: 'comercial', requires: 'comercial:manage_pipeline', label: 'Criar etapa', input: {} as any, handler: jest.fn() },
}));

function mockRequest(method: string, url: string, body?: unknown): NextRequest {
  return {
    method,
    url,
    json: jest.fn().mockResolvedValue(body ?? {}),
    nextUrl: { searchParams: new URL(url).searchParams, pathname: new URL(url).pathname },
    headers: new Map(),
  } as unknown as NextRequest;
}

describe('Comercial route gates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsEnabled.mockResolvedValue(true);
  });

  describe('leads routes', () => {
    it('returns 404 when module is disabled', async () => {
      mockIsEnabled.mockResolvedValue(false);
      const { GET } = await import('@/app/api/leads/route');
      const response = await GET(mockRequest('GET', 'http://localhost:3000/api/leads'));
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('pipeline stages routes', () => {
    it('returns 404 when module is disabled', async () => {
      mockIsEnabled.mockResolvedValue(false);
      const { GET } = await import('@/app/api/pipeline/stages/route');
      const response = await GET(mockRequest('GET', 'http://localhost:3000/api/pipeline/stages'));
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
