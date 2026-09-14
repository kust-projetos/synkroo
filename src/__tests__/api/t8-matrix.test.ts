/**
 * T8 matrix — autorização canônica para rotas legadas sensíveis.
 *
 * Matriz por rota: anônimo (401), autenticado sem permissão (403),
 * clínica correta (2xx), ID estrangeiro (404/tenant-scoped).
 *
 * Usa infraestrutura real (validateApiAuth → RBAC, services tenant-scoped)
 * via mocks de DB/serviços controlados, sem can:()=>true tautológico.
 */

// ── Mocks ───────────────────────────────────────────────────────────────────
jest.mock('@/core/modules/manifest', () => ({
  createManifest: () => ({
    isEnabled: jest.fn().mockResolvedValue(true),
    enabledModules: jest.fn().mockResolvedValue(new Set(['operacional', 'financeiro', 'followup', 'crm', 'ia', 'core'])),
  }),
  drizzleManifestRepo: { getEnabledModuleIds: jest.fn().mockResolvedValue(['operacional']) },
}));
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => ({ select: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), then: jest.fn((fn:any)=>Promise.resolve(fn([]))) } as any)) }));
jest.mock('@/services/followup/segmentation.service', () => ({
  listSegments: jest.fn(),
  createSegment: jest.fn(),
  previewSegmentSize: jest.fn(),
  getSegmentPatients: jest.fn(),
}));
jest.mock('@/modules/financeiro/services/budget-service', () => ({
  getBudget: jest.fn(),
  acceptBudget: jest.fn(),
  rejectBudget: jest.fn(),
}));
jest.mock('@/modules/financeiro/repositories/financeiro-repository', () => ({
  updateBudget: jest.fn(),
}));
jest.mock('@/services/custom-fields/definitions.service', () => ({
  getDefinitions: jest.fn(),
  getDefinitionById: jest.fn(),
  createDefinition: jest.fn(),
  updateDefinition: jest.fn(),
  deleteDefinition: jest.fn(),
  exportDefinitions: jest.fn(),
  importDefinitions: jest.fn(),
}));
jest.mock('@/services/custom-fields/values.service', () => ({
  getValuesForContact: jest.fn(),
  upsertValues: jest.fn(),
  deleteValuesForContact: jest.fn(),
}));
jest.mock('@/services/reports/financial-reports.service', () => ({
  getFinancialReport: jest.fn(),
}));
jest.mock('@/services/treatment-plans/treatment-plan.service', () => ({
  getTreatmentPlansByPatient: jest.fn(),
  createTreatmentPlan: jest.fn(),
  getTreatmentPlanById: jest.fn(),
  updateTreatmentPlan: jest.fn(),
  deleteTreatmentPlan: jest.fn(),
}));
jest.mock('@/services/patients/patient-preferences.service', () => ({
  getPreferences: jest.fn(),
  setPreference: jest.fn(),
}));
jest.mock('@/repositories/patients', () => ({
  findByIdScoped: jest.fn(),
}));

// validateApiAuth mock — controla anon vs auth vs forbidden sem can tautológico
const mockValidateApiAuth = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: (...args: unknown[]) => mockValidateApiAuth(...args),
}));

// helpers de auth
function authOk(profile: any = { id: 'u1', clinic_id: 'clinic-a', role: 'owner' }) {
  mockValidateApiAuth.mockResolvedValue({ success: true, profile });
}
function authAnon() {
  mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } });
}
function authForbidden() {
  mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Insufficient permissions', status: 403 } });
}

// ── Imports após mocks ─────────────────────────────────────────────────────
import { POST as BudgetAcceptPOST } from '@/app/api/budgets/[id]/accept/route';
import { POST as BudgetRejectPOST } from '@/app/api/budgets/[id]/reject/route';
import { GET as SegmentsGET, POST as SegmentsPOST } from '@/app/api/campaigns/segments/route';
import { GET as SegmentsPreviewGET } from '@/services/api-handlers/campaigns/segments/preview';
import { GET as CfDefsGET, POST as CfDefsPOST } from '@/app/api/custom-fields/definitions/route';
import { GET as CfDefByIdGET, PUT as CfDefByIdPUT, DELETE as CfDefByIdDELETE } from '@/app/api/custom-fields/definitions/[id]/route';
import { GET as CfValsGET, POST as CfValsPOST, DELETE as CfValsDELETE } from '@/app/api/custom-fields/values/route';
import { GET as ReportsFinancialGET } from '@/app/api/reports/financial/route';
import { GET as TpListGET, POST as TpCreatePOST } from '@/app/api/treatment-plans/route';
import { GET as TpGetGET, PATCH as TpPatchPATCH, DELETE as TpDeleteDELETE } from '@/app/api/treatment-plans/[id]/route';
import { GET as PrefGET, POST as PrefPOST } from '@/app/api/patients/[id]/preferences/route';
import { NextRequest as NextReq } from 'next/server';
import { GET as KnowledgeGET, POST as KnowledgePOST } from '@/services/api-handlers/knowledge';
import { GET as KnowledgeByIdGET } from '@/services/api-handlers/knowledge/[id]';
import { GET as KnowledgeCategoriesGET } from '@/services/api-handlers/knowledge/categories';
import { POST as KnowledgeIngestPOST } from '@/app/api/knowledge/ingest/route';
import { POST as KnowledgeSearchPOST } from '@/app/api/knowledge/search/route';

import { getBudget, acceptBudget, rejectBudget } from '@/modules/financeiro/services/budget-service';
import { listSegments, createSegment, previewSegmentSize } from '@/services/followup/segmentation.service';
import { getDefinitions, getDefinitionById, createDefinition } from '@/services/custom-fields/definitions.service';
import { getValuesForContact, upsertValues } from '@/services/custom-fields/values.service';
import { getFinancialReport } from '@/services/reports/financial-reports.service';
import { getTreatmentPlansByPatient, createTreatmentPlan, getTreatmentPlanById } from '@/services/treatment-plans/treatment-plan.service';
import { getPreferences, setPreference } from '@/services/patients/patient-preferences.service';
import { findByIdScoped } from '@/repositories/patients';

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Budgets accept/reject ──────────────────────────────────────────────────
// D2 lote 3/5 (financeiro): envelope canônico.
describe('T8 budgets/[id]/accept — matriz', () => {
  const routeParams = params('budget-1');
  it('401 anônimo (envelope canônico)', async () => {
    authAnon();
    const r = await BudgetAcceptPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any, routeParams);
    expect(r.status).toBe(401);
    expect((await r.json()).error.code).toBe('UNAUTHORIZED');
  });
  it('403 autenticado sem permissão (envelope canônico)', async () => {
    authForbidden();
    const r = await BudgetAcceptPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any, routeParams);
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe('FORBIDDEN');
  });
  it('200 clínica correta (envelope canônico)', async () => {
    authOk({ id: 'u1', clinic_id: 'clinic-a' });
    (getBudget as jest.Mock).mockResolvedValue({ id: 'budget-1', clinicId: 'clinic-a', status: 'pending' });
    (acceptBudget as jest.Mock).mockResolvedValue({ id: 'budget-1', clinicId: 'clinic-a', status: 'accepted' });
    const r = await BudgetAcceptPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any, routeParams);
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b.data.budget.status).toBe('accepted');
  });
  it('404 ID estrangeiro (tenant-scoped opaco, envelope canônico)', async () => {
    authOk({ id: 'u1', clinic_id: 'clinic-a' });
    (getBudget as jest.Mock).mockResolvedValue({ id: 'budget-1', clinicId: 'clinic-b', status: 'pending' });
    const r = await BudgetAcceptPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any, routeParams);
    expect(r.status).toBe(404);
    expect((await r.json()).error.message).toMatch(/not found/i);
    expect(acceptBudget).not.toHaveBeenCalled();
  });
});

describe('T8 budgets/[id]/reject — matriz', () => {
  const routeParams = params('budget-1');
  it('401 anônimo', async () => {
    authAnon();
    const r = await BudgetRejectPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any, routeParams);
    expect(r.status).toBe(401);
  });
  it('403 sem permissão', async () => {
    authForbidden();
    const r = await BudgetRejectPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any, routeParams);
    expect(r.status).toBe(403);
  });
  it('200 clínica correta', async () => {
    authOk({ id: 'u1', clinic_id: 'clinic-a' });
    (getBudget as jest.Mock).mockResolvedValue({ id: 'budget-1', clinicId: 'clinic-a', status: 'pending' });
    (rejectBudget as jest.Mock).mockResolvedValue({ id: 'budget-1', clinicId: 'clinic-a', status: 'rejected' });
    const r = await BudgetRejectPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any, routeParams);
    expect(r.status).toBe(200);
  });
  it('404 ID estrangeiro', async () => {
    authOk({ id: 'u1', clinic_id: 'clinic-a' });
    (getBudget as jest.Mock).mockResolvedValue({ id: 'budget-1', clinicId: 'clinic-b', status: 'pending' });
    const r = await BudgetRejectPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any, routeParams);
    expect(r.status).toBe(404);
    expect(rejectBudget).not.toHaveBeenCalled();
  });
});

// ── Campaigns segments ─────────────────────────────────────────────────────
// D2 lote 5/5 (followup): envelope canônico.
describe('T8 campaigns/segments — matriz', () => {
  it('GET 401 anônimo (envelope canônico)', async () => { authAnon(); const r = await SegmentsGET(new Request('http://x') as any); expect(r.status).toBe(401); expect((await r.json()).error.code).toBe('UNAUTHORIZED'); });
  it('GET 403 sem permissão', async () => { authForbidden(); const r = await SegmentsGET(new Request('http://x') as any); expect(r.status).toBe(403); });
  it('GET 200 clínica correta (envelope canônico)', async () => { authOk(); (listSegments as jest.Mock).mockResolvedValue([]); const r = await SegmentsGET(new Request('http://x') as any); expect(r.status).toBe(200); expect(listSegments).toHaveBeenCalledWith('clinic-a'); expect((await r.json()).data.segments).toEqual([]); });
  it('POST 401 anônimo', async () => { authAnon(); const r = await SegmentsPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any); expect(r.status).toBe(401); });
  it('POST 403 sem permissão', async () => { authForbidden(); const r = await SegmentsPOST(new Request('http://x', { method: 'POST', body: JSON.stringify({ name: 'x', criteria: {} }) }) as any); expect(r.status).toBe(403); });
  it('GET preview 401 anônimo', async () => { authAnon(); const r = await SegmentsPreviewGET(new Request('http://x?type=reactivation') as any); expect(r.status).toBe(401); });
  it('GET preview 403 sem permissão', async () => { authForbidden(); const r = await SegmentsPreviewGET(new Request('http://x?type=reactivation') as any); expect(r.status).toBe(403); });
});

// ── Custom-fields definitions ─────────────────────────────────────────────
// D2 lote 1 (crm): envelope canônico { data } / { error: { code, message, requestId } }.
describe('T8 custom-fields/definitions — matriz', () => {
  it('GET 401 anônimo (envelope canônico)', async () => { authAnon(); const r = await CfDefsGET(new Request('http://x') as any); expect(r.status).toBe(401); expect((await r.json()).error.code).toBe('UNAUTHORIZED'); });
  it('GET 403 sem permissão (envelope canônico)', async () => { authForbidden(); const r = await CfDefsGET(new Request('http://x') as any); expect(r.status).toBe(403); expect((await r.json()).error.code).toBe('FORBIDDEN'); });
  it('GET 200 tenant-scoped (envelope canônico)', async () => { authOk(); (getDefinitions as jest.Mock).mockResolvedValue([{ id: 'd1' }]); const r = await CfDefsGET(new Request('http://x') as any); expect(r.status).toBe(200); expect(getDefinitions).toHaveBeenCalledWith('clinic-a'); expect((await r.json()).data).toEqual([{ id: 'd1' }]); });
  it('POST 403 sem permissão', async () => { authForbidden(); const r = await CfDefsPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any); expect(r.status).toBe(403); });
  it('POST 201 clínica correta (envelope canônico)', async () => { authOk(); (createDefinition as jest.Mock).mockResolvedValue({ id: 'd1' }); const r = await CfDefsPOST(new Request('http://x', { method: 'POST', body: JSON.stringify({ name: 'x', field_type: 'text' }) }) as any); expect(r.status).toBe(201); expect((await r.json()).data).toEqual({ id: 'd1' }); });
  it('POST 400 payload inválido (envelope canônico)', async () => { authOk(); const r = await CfDefsPOST(new Request('http://x', { method: 'POST', body: JSON.stringify({ name: '', field_type: 'bogus' }) }) as any); expect(r.status).toBe(400); expect((await r.json()).error.code).toBe('INVALID_INPUT'); });
  it('GET [id] 404 estrangeiro (envelope canônico)', async () => { authOk(); (getDefinitionById as jest.Mock).mockResolvedValue(null); const r = await CfDefByIdGET(new Request('http://x') as any, params('d-foreign')); expect(r.status).toBe(404); expect((await r.json()).error.code).toBe('NOT_FOUND'); });
  it('DELETE 403 sem permissão', async () => { authForbidden(); const r = await CfDefByIdDELETE(new Request('http://x', { method: 'DELETE' }) as any, params('d1')); expect(r.status).toBe(403); });
});

describe('T8 custom-fields/values — matriz', () => {
  it('GET 401 anônimo', async () => { authAnon(); const r = await CfValsGET(new Request('http://x?contact_id=c1&contact_type=patient') as any); expect(r.status).toBe(401); });
  it('GET 403 sem permissão', async () => { authForbidden(); const r = await CfValsGET(new Request('http://x?contact_id=c1&contact_type=patient') as any); expect(r.status).toBe(403); });
  it('GET 200 tenant-scoped (envelope canônico)', async () => { authOk(); (getValuesForContact as jest.Mock).mockResolvedValue([]); const r = await CfValsGET(new Request('http://x?contact_id=c1&contact_type=patient') as any); expect(r.status).toBe(200); expect(getValuesForContact).toHaveBeenCalledWith('clinic-a', 'c1', 'patient'); expect((await r.json()).data).toEqual([]); });
  it('GET 400 sem query params (envelope canônico)', async () => { authOk(); const r = await CfValsGET(new Request('http://x') as any); expect(r.status).toBe(400); expect((await r.json()).error.code).toBe('INVALID_INPUT'); });
  it('POST 403 sem permissão', async () => { authForbidden(); const r = await CfValsPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any); expect(r.status).toBe(403); });
  it('DELETE 403 sem permissão', async () => { authForbidden(); const r = await CfValsDELETE(new Request('http://x?contact_id=c1&contact_type=patient') as any); expect(r.status).toBe(403); });
});

// ── Knowledge ──────────────────────────────────────────────────────────────
describe('T8 knowledge — matriz', () => {
  it('GET /api/knowledge 401', async () => { authAnon(); const r = await KnowledgeGET(new Request('http://x') as any); expect(r.status).toBe(401); });
  it('GET /api/knowledge 403', async () => { authForbidden(); const r = await KnowledgeGET(new Request('http://x') as any); expect(r.status).toBe(403); });
  it('POST /api/knowledge 403', async () => { authForbidden(); const r = await KnowledgePOST(new Request('http://x', { method: 'POST', body: '{}' }) as any); expect(r.status).toBe(403); });
  it('GET /api/knowledge/[id] 403', async () => { authForbidden(); const r = await KnowledgeByIdGET(new Request('http://x') as any, params('k1')); expect(r.status).toBe(403); });
  it('GET /api/knowledge/categories 401', async () => { authAnon(); const r = await KnowledgeCategoriesGET(new Request('http://x') as any); expect(r.status).toBe(401); });
  it('POST /api/knowledge/ingest 403', async () => { authForbidden(); const r = await KnowledgeIngestPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any); expect(r.status).toBe(403); });
  it('POST /api/knowledge/search 401', async () => { authAnon(); const r = await KnowledgeSearchPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any); expect(r.status).toBe(401); });
  it('POST /api/knowledge/search 403', async () => { authForbidden(); const r = await KnowledgeSearchPOST(new Request('http://x', { method: 'POST', body: JSON.stringify({ query: 'x' }) }) as any); expect(r.status).toBe(403); });
});

// ── Reports financial ──────────────────────────────────────────────────────
// D2 lote 5/5: envelope canônico.
describe('T8 reports/financial — matriz', () => {
  it('401 anônimo (envelope canônico)', async () => { authAnon(); const r = await ReportsFinancialGET(new Request('http://x?period=month') as any); expect(r.status).toBe(401); expect((await r.json()).error.code).toBe('UNAUTHORIZED'); });
  it('403 sem permissão', async () => { authForbidden(); const r = await ReportsFinancialGET(new Request('http://x?period=month') as any); expect(r.status).toBe(403); });
  it('400 sem period (envelope canônico)', async () => { authOk(); const r = await ReportsFinancialGET(new Request('http://x') as any); expect(r.status).toBe(400); expect((await r.json()).error.code).toBe('INVALID_INPUT'); });
  it('200 clínica correta tenant-scoped (envelope canônico)', async () => { authOk(); (getFinancialReport as jest.Mock).mockResolvedValue({ period: '2026-09', revenue: 100, payments: 50, outstanding: 50, byProcedure: [] }); const r = await ReportsFinancialGET(new Request('http://x?period=month') as any); expect(r.status).toBe(200); expect(getFinancialReport).toHaveBeenCalledWith('clinic-a', 'month', expect.any(Date)); expect((await r.json()).data.revenue).toBe(100); });
});

// ── Treatment plans ────────────────────────────────────────────────────────
// D2 lote 4/5 (operacional): envelope canônico.
describe('T8 treatment-plans — matriz', () => {
  it('GET /api/treatment-plans 401 (envelope canônico)', async () => { authAnon(); const r = await TpListGET(new NextReq('http://x?patient_id=p1') as any); expect(r.status).toBe(401); expect((await r.json()).error.code).toBe('UNAUTHORIZED'); });
  it('GET /api/treatment-plans 403', async () => { authForbidden(); const r = await TpListGET(new NextReq('http://x?patient_id=p1') as any); expect(r.status).toBe(403); });
  it('GET /api/treatment-plans 200 tenant-scoped (envelope canônico)', async () => { authOk(); (getTreatmentPlansByPatient as jest.Mock).mockResolvedValue([]); const r = await TpListGET(new NextReq('http://x?patient_id=p1') as any); expect(r.status).toBe(200); expect(getTreatmentPlansByPatient).toHaveBeenCalledWith('p1', 'clinic-a'); expect((await r.json()).data.treatment_plans).toEqual([]); });
  it('GET /api/treatment-plans 400 sem patient_id (envelope canônico)', async () => { authOk(); const r = await TpListGET(new NextReq('http://x') as any); expect(r.status).toBe(400); expect((await r.json()).error.code).toBe('INVALID_INPUT'); });
  it('POST 403', async () => { authForbidden(); const r = await TpCreatePOST(new NextReq('http://x', { method: 'POST', body: '{}' }) as any); expect(r.status).toBe(403); });
  it('GET [id] 404 estrangeiro (envelope canônico)', async () => { authOk(); (getTreatmentPlanById as jest.Mock).mockResolvedValue(null); const r = await TpGetGET(new NextReq('http://x') as any, params('plan-foreign')); expect(r.status).toBe(404); expect((await r.json()).error.code).toBe('NOT_FOUND'); });
  it('PATCH 403', async () => { authForbidden(); const r = await TpPatchPATCH(new NextReq('http://x', { method: 'PATCH', body: '{}' }) as any, params('plan-1')); expect(r.status).toBe(403); });
  it('DELETE 403', async () => { authForbidden(); const r = await TpDeleteDELETE(new NextReq('http://x', { method: 'DELETE' }) as any, params('plan-1')); expect(r.status).toBe(403); });
});

// ── Patients preferences ───────────────────────────────────────────────────
// D2 lote 4/5 (operacional): envelope canônico.
describe('T8 patients/[id]/preferences — matriz', () => {
  it('GET 401 (envelope canônico)', async () => { authAnon(); const r = await PrefGET(new Request('http://x') as any, params('pat-1')); expect(r.status).toBe(401); expect((await r.json()).error.code).toBe('UNAUTHORIZED'); });
  it('GET 403', async () => { authForbidden(); const r = await PrefGET(new Request('http://x') as any, params('pat-1')); expect(r.status).toBe(403); });
  it('GET 404 estrangeiro', async () => { authOk(); (findByIdScoped as jest.Mock).mockResolvedValue(null); const r = await PrefGET(new Request('http://x') as any, params('pat-foreign')); expect(r.status).toBe(404); });
  it('GET 200 clínica correta (envelope canônico)', async () => { authOk(); (findByIdScoped as jest.Mock).mockResolvedValue({ id: 'pat-1', clinicId: 'clinic-a' }); (getPreferences as jest.Mock).mockResolvedValue([]); const r = await PrefGET(new Request('http://x') as any, params('pat-1')); expect(r.status).toBe(200); expect(getPreferences).toHaveBeenCalledWith('pat-1', undefined); expect((await r.json()).data.preferences).toEqual([]); });
  it('POST 403', async () => { authForbidden(); const r = await PrefPOST(new Request('http://x', { method: 'POST', body: '{}' }) as any, params('pat-1')); expect(r.status).toBe(403); });
  it('POST 404 estrangeiro', async () => { authOk(); (findByIdScoped as jest.Mock).mockResolvedValue(null); const r = await PrefPOST(new Request('http://x', { method: 'POST', body: JSON.stringify({ key: 'k', value: 'v', category: 'general' }) }) as any, params('pat-foreign')); expect(r.status).toBe(404); });
  it('POST 200 clínica correta (envelope canônico)', async () => { authOk(); (findByIdScoped as jest.Mock).mockResolvedValue({ id: 'pat-1', clinicId: 'clinic-a' }); (setPreference as jest.Mock).mockResolvedValue({ id: 'pref-1', key: 'k' }); const r = await PrefPOST(new Request('http://x', { method: 'POST', body: JSON.stringify({ key: 'k', value: 'v', category: 'general' }) }) as any, params('pat-1')); expect(r.status).toBe(200); expect((await r.json()).data.preference).toEqual({ id: 'pref-1', key: 'k' }); });
});
