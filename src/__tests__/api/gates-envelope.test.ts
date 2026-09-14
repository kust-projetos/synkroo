/**
 * Review D2D3 item 3 — gate withModuleRoute com envelope canônico.
 *
 * Amostra: 1 rota de cada lote D2. Módulo desabilitado + autenticado → 404
 * { error: { code: 'NOT_FOUND', ... } }. Ordem fixada: o gate roda ANTES do
 * handler, logo desabilitado + anônimo → 404 (não 401); só com módulo
 * habilitado o anônimo chega ao 401 da rota.
 */
const mockIsEnabled = jest.fn().mockResolvedValue(true);
jest.mock('@/core/modules/manifest', () => ({
  createManifest: () => ({
    isEnabled: (...args: unknown[]) => mockIsEnabled(...args),
    enabledModules: jest.fn().mockResolvedValue(new Set(['core'])),
  }),
}));

const mockValidateApiAuth = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: (...args: unknown[]) => mockValidateApiAuth(...args),
}));

jest.mock('@/services/custom-fields/definitions.service', () => ({
  getDefinitions: jest.fn(),
  createDefinition: jest.fn(),
  exportDefinitions: jest.fn(),
  importDefinitions: jest.fn(),
}));
jest.mock('@/core/actions/context', () => ({
  buildUserContext: jest.fn(),
  buildSystemContext: jest.fn(),
}));
jest.mock('@/core/actions/run', () => ({ runAction: jest.fn() }));
jest.mock('@/modules/financeiro/services/budget-service', () => ({
  getBudget: jest.fn(),
  acceptBudget: jest.fn(),
  rejectBudget: jest.fn(),
}));
jest.mock('@/services/treatment-plans/treatment-plan.service', () => ({
  getTreatmentPlansByPatient: jest.fn(),
  createTreatmentPlan: jest.fn(),
  getTreatmentPlanById: jest.fn(),
  updateTreatmentPlan: jest.fn(),
  deleteTreatmentPlan: jest.fn(),
}));
jest.mock('@/services/followup/campaign.service', () => ({
  getCampaigns: jest.fn(),
  createCampaign: jest.fn(),
  createReactivationCampaign: jest.fn(),
  startCampaign: jest.fn(),
  addCampaignRecipients: jest.fn(),
}));
jest.mock('@/services/followup/inactive-patient.service', () => ({
  getInactivityStats: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { buildUserContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';

const authOk = () => {
  mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } });
  (buildUserContext as jest.Mock).mockResolvedValue({
    source: 'user', clinicId: 'c1', user: { id: 'u1' },
    can: () => true, hasModule: () => true, audit: { actor: 'u1' },
  });
};
const authAnon = () => {
  mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } });
  (buildUserContext as jest.Mock).mockRejectedValue(new Error('unauthenticated'));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIsEnabled.mockResolvedValue(true);
});

async function json(res: Response) {
  return res.json() as Promise<any>;
}

describe('gate desabilitado + autenticado → 404 envelope canônico (1 rota por lote D2)', () => {
  it('L1 crm: GET /api/custom-fields/definitions', async () => {
    mockIsEnabled.mockResolvedValue(false);
    authOk();
    const { GET } = await import('@/app/api/custom-fields/definitions/route');
    const r = await GET(new Request('http://x') as any);
    expect(r.status).toBe(404);
    expect((await json(r)).error.code).toBe('NOT_FOUND');
  });

  it('L2 comercial: GET /api/leads', async () => {
    mockIsEnabled.mockResolvedValue(false);
    authOk();
    const { GET } = await import('@/app/api/leads/route');
    const r = await GET(new Request('http://x/api/leads') as any);
    expect(r.status).toBe(404);
    expect((await json(r)).error.code).toBe('NOT_FOUND');
    expect(runAction).not.toHaveBeenCalled();
  });

  it('L3 financeiro: POST /api/budgets/[id]/accept', async () => {
    mockIsEnabled.mockResolvedValue(false);
    authOk();
    const { POST } = await import('@/app/api/budgets/[id]/accept/route');
    const r = await POST(
      new Request('http://x', { method: 'POST', body: '{}' }) as any,
      { params: Promise.resolve({ id: 'b1' }) },
    );
    expect(r.status).toBe(404);
    expect((await json(r)).error.code).toBe('NOT_FOUND');
  });

  it('L4 operacional: GET /api/treatment-plans', async () => {
    mockIsEnabled.mockResolvedValue(false);
    authOk();
    const { GET } = await import('@/app/api/treatment-plans/route');
    const { NextRequest } = await import('next/server');
    const r = await GET(new NextRequest('http://x?patient_id=p1') as any);
    expect(r.status).toBe(404);
    expect((await json(r)).error.code).toBe('NOT_FOUND');
  });

  it('L5 followup: GET /api/campaigns', async () => {
    mockIsEnabled.mockResolvedValue(false);
    authOk();
    const { GET } = await import('@/app/api/campaigns/route');
    const { NextRequest } = await import('next/server');
    const r = await GET(new NextRequest('http://x/api/campaigns') as any);
    expect(r.status).toBe(404);
    expect((await json(r)).error.code).toBe('NOT_FOUND');
  });
});

describe('ordem gate → auth (comportamento fixado)', () => {
  it('desabilitado + anônimo → 404 (gate precede o 401)', async () => {
    mockIsEnabled.mockResolvedValue(false);
    authAnon();
    const { GET } = await import('@/app/api/leads/route');
    const r = await GET(new Request('http://x/api/leads') as any);
    expect(r.status).toBe(404);
    expect((await json(r)).error.code).toBe('NOT_FOUND');
  });

  it('habilitado + anônimo → 401 da rota', async () => {
    mockIsEnabled.mockResolvedValue(true);
    authAnon();
    const { GET } = await import('@/app/api/leads/route');
    const r = await GET(new Request('http://x/api/leads') as any);
    expect(r.status).toBe(401);
  });
});
