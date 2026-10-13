/**
 * GET /api/treatment-plans — branch include_financials (FIN-MISMATCH).
 *
 * (1) sem o param, a resposta é byte-equivalente à anterior
 *     ({ data: { treatment_plans } }) e nenhum serviço financeiro é chamado;
 * (2) com ?include_financials=true, responde o contrato canônico (D2 lote 4)
 *     { data: { financial_summary } } no shape consumido por useFinancialSummary.
 */
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }));
jest.mock('@/core/modules/gates', () => ({ withModuleRoute: () => (h: unknown) => h }));
jest.mock('@/services/treatment-plans/treatment-plan.service', () => ({
  getTreatmentPlansByPatient: jest.fn(),
  createTreatmentPlan: jest.fn(),
}));
jest.mock('@/modules/financeiro/services/budget-service', () => ({
  listBudgets: jest.fn(),
}));
jest.mock('@/modules/financeiro/services/installment-service', () => ({
  listInstallments: jest.fn(),
}));
jest.mock('@/modules/financeiro/services/payment-service', () => ({
  listPayments: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/treatment-plans/route';
import { validateApiAuth } from '@/lib/auth/session';
import { getTreatmentPlansByPatient } from '@/services/treatment-plans/treatment-plan.service';
import { listBudgets } from '@/modules/financeiro/services/budget-service';
import { listInstallments } from '@/modules/financeiro/services/installment-service';
import { listPayments } from '@/modules/financeiro/services/payment-service';

const mockAuth = validateApiAuth as jest.Mock;
const mockPlans = getTreatmentPlansByPatient as jest.Mock;
const mockBudgets = listBudgets as jest.Mock;
const mockInstallments = listInstallments as jest.Mock;
const mockPayments = listPayments as jest.Mock;

function authOk() {
  mockAuth.mockResolvedValue({
    success: true,
    profile: { id: 'u1', clinic_id: 'clinic-a', role: 'owner' },
  });
}

const plan = {
  id: 'tp-1',
  clinic_id: 'clinic-a',
  patient_id: 'p1',
  title: 'Plano A',
  total_sessions: 10,
  completed_sessions: 4,
  status: 'active',
  items: [],
};

const budgetRow = {
  id: 'b-1',
  clinicId: 'clinic-a',
  patientId: 'p1',
  treatmentPlanId: 'tp-1',
  title: 'Orçamento A',
  totalValue: '1000.00',
  finalValue: '1000.00',
  status: 'accepted',
};

const installmentRows = [
  {
    id: 'i-1',
    budgetId: 'b-1',
    amount: '400.00',
    dueDate: '2026-09-01',
    status: 'paid',
    paidAt: new Date('2026-09-01T10:00:00.000Z'),
  },
  {
    id: 'i-2',
    budgetId: 'b-1',
    amount: '600.00',
    dueDate: '2026-10-01',
    status: 'pending',
    paidAt: null,
  },
];

const paymentRows = [
  {
    id: 'pay-1',
    budgetId: 'b-1',
    amount: '400.00',
    paymentMethod: 'pix',
    paidAt: new Date('2026-09-01T10:00:00.000Z'),
    notes: null,
  },
];

function get(url: string) {
  return GET(new NextRequest(`http://x${url}`) as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  authOk();
});

describe('GET /api/treatment-plans — resposta default preservada', () => {
  it('sem param retorna { data: { treatment_plans } } sem tocar serviços financeiros', async () => {
    mockPlans.mockResolvedValue([plan]);
    const r = await get('?patient_id=p1');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: { treatment_plans: [plan] } });
    expect(mockBudgets).not.toHaveBeenCalled();
    expect(mockInstallments).not.toHaveBeenCalled();
    expect(mockPayments).not.toHaveBeenCalled();
  });

  it('include_financials=false cai no default', async () => {
    mockPlans.mockResolvedValue([plan]);
    const r = await get('?patient_id=p1&include_financials=false');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: { treatment_plans: [plan] } });
    expect(mockBudgets).not.toHaveBeenCalled();
  });

  it('sem patient_id retorna 400 mesmo com include_financials', async () => {
    const r = await get('?include_financials=true');
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('INVALID_INPUT');
    expect(mockPlans).not.toHaveBeenCalled();
  });
});

describe('GET /api/treatment-plans?include_financials=true', () => {
  beforeEach(() => {
    mockPlans.mockResolvedValue([plan]);
    mockBudgets.mockResolvedValue([budgetRow]);
    mockInstallments.mockResolvedValue(installmentRows);
    mockPayments.mockResolvedValue(paymentRows);
  });

  it('responde { data: { financial_summary } } no shape do hook', async () => {
    const r = await get('?patient_id=p1&include_financials=true');
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(Object.keys(body.data)).toEqual(['financial_summary']);
    const summary = body.data.financial_summary;

    expect(summary.totalBilled).toBe(1000);
    expect(summary.totalPaid).toBe(400);
    expect(summary.totalOwed).toBe(600);
    expect(summary.plans).toHaveLength(1);

    const [entry] = summary.plans;
    expect(entry.plan).toEqual(plan);
    expect(entry.budget).toEqual({ id: 'b-1' });
    expect(entry.billed).toBe(1000);
    expect(entry.paid).toBe(400);
    expect(entry.owed).toBe(600);
    expect(entry.sessionsCompleted).toBe(4);
    expect(entry.sessionsTotal).toBe(10);
    expect(entry.installments).toEqual([
      {
        id: 'i-1',
        budget_id: 'b-1',
        amount: 400,
        due_date: '2026-09-01',
        status: 'paid',
        paid_at: '2026-09-01T10:00:00.000Z',
      },
      {
        id: 'i-2',
        budget_id: 'b-1',
        amount: 600,
        due_date: '2026-10-01',
        status: 'pending',
        paid_at: null,
      },
    ]);
    expect(entry.payments).toEqual([
      {
        id: 'pay-1',
        budget_id: 'b-1',
        amount: 400,
        payment_method: 'pix',
        paid_at: '2026-09-01T10:00:00.000Z',
      },
    ]);

    expect(mockBudgets).toHaveBeenCalledWith('clinic-a');
    expect(mockInstallments).toHaveBeenCalledWith('clinic-a', 'b-1');
    expect(mockPayments).toHaveBeenCalledWith('clinic-a', 'b-1');
  });

  it('plano sem orçamento vinculado retorna budget null com zeros e sessões do plano', async () => {
    const planNoBudget = {
      id: 'tp-9',
      clinic_id: 'clinic-a',
      patient_id: 'p1',
      title: 'Plano sem orçamento',
      total_sessions: 6,
      status: 'active',
      items: [
        { id: 'it-1', status: 'completed' },
        { id: 'it-2', status: 'pending' },
      ],
    };
    mockPlans.mockResolvedValue([planNoBudget]);
    const r = await get('?patient_id=p1&include_financials=true');
    expect(r.status).toBe(200);
    const summary = (await r.json()).data.financial_summary;
    expect(summary.plans).toHaveLength(1);
    expect(summary.plans[0]).toEqual({
      plan: planNoBudget,
      budget: null,
      installments: [],
      payments: [],
      billed: 0,
      paid: 0,
      owed: 0,
      sessionsCompleted: 1,
      sessionsTotal: 6,
    });
    expect(summary.totalBilled).toBe(0);
    expect(summary.totalPaid).toBe(0);
    expect(summary.totalOwed).toBe(0);
    expect(mockInstallments).not.toHaveBeenCalled();
    expect(mockPayments).not.toHaveBeenCalled();
  });
});

describe('GET /api/treatment-plans?include_financials=true — hardening FIN-FIX-REVIEW', () => {
  beforeEach(() => {
    mockPlans.mockResolvedValue([plan]);
    mockBudgets.mockResolvedValue([budgetRow]);
    mockInstallments.mockResolvedValue(installmentRows);
    mockPayments.mockResolvedValue(paymentRows);
  });

  it('403 quando usuário tem operacional:view mas não financeiro:view', async () => {
    mockAuth.mockImplementation((perm?: string) =>
      perm === 'financeiro:view'
        ? Promise.resolve({
            success: false,
            error: { message: 'Insufficient permissions', status: 403 },
          })
        : Promise.resolve({
            success: true,
            profile: { id: 'u1', clinic_id: 'clinic-a', role: 'staff' },
          }),
    );
    const r = await get('?patient_id=p1&include_financials=true');
    expect(r.status).toBe(403);
    // Fail-fast total: sem financeiro:view, nenhuma leitura é executada
    // ou descartada — nem planos, nem serviços financeiros.
    expect(mockPlans).not.toHaveBeenCalled();
    expect(mockBudgets).not.toHaveBeenCalled();
    expect(mockInstallments).not.toHaveBeenCalled();
    expect(mockPayments).not.toHaveBeenCalled();
  });

  it('200 com ambas as permissões; default sem param não exige financeiro:view', async () => {
    // Uma única chamada de auth no default → segunda permissão nunca checada.
    mockPlans.mockResolvedValue([plan]);
    const r = await get('?patient_id=p1');
    expect(r.status).toBe(200);
    expect(mockAuth).toHaveBeenCalledTimes(1);
    expect(mockAuth).toHaveBeenCalledWith('operacional:view');
  });

  it('totalOwed soma os owed individuais sem compensação cruzada', async () => {
    const plans = [
      { ...plan, id: 'tp-1' },
      { ...plan, id: 'tp-2', title: 'Plano B' },
    ];
    mockPlans.mockResolvedValue(plans);
    mockBudgets.mockResolvedValue([
      { ...budgetRow, id: 'b-1', treatmentPlanId: 'tp-1', finalValue: '100.00' },
      { ...budgetRow, id: 'b-2', treatmentPlanId: 'tp-2', finalValue: '100.00' },
    ]);
    mockInstallments.mockImplementation((_clinic: string, budgetId: string) =>
      Promise.resolve([]),
    );
    mockPayments.mockImplementation((_clinic: string, budgetId: string) =>
      Promise.resolve(
        budgetId === 'b-1'
          ? [
              {
                id: 'pay-big',
                budgetId: 'b-1',
                amount: '150.00',
                paymentMethod: 'pix',
                paidAt: new Date('2026-09-01T10:00:00.000Z'),
                notes: 'overpay',
              },
            ]
          : [],
      ),
    );
    const r = await get('?patient_id=p1&include_financials=true');
    expect(r.status).toBe(200);
    const summary = (await r.json()).data.financial_summary;
    expect(summary.plans.map((p: { owed: number }) => p.owed)).toEqual([0, 100]);
    expect(summary.totalBilled).toBe(200);
    expect(summary.totalPaid).toBe(150);
    expect(summary.totalOwed).toBe(100);
    // Filtro de clínica preservado em todas as chamadas por budget.
    for (const call of mockInstallments.mock.calls) expect(call[0]).toBe('clinic-a');
    for (const call of mockPayments.mock.calls) expect(call[0]).toBe('clinic-a');
  });

  it('payload de payments não expõe notes (PII-minimization)', async () => {
    mockPayments.mockResolvedValue([
      {
        id: 'pay-1',
        budgetId: 'b-1',
        amount: '400.00',
        paymentMethod: 'pix',
        paidAt: new Date('2026-09-01T10:00:00.000Z'),
        notes: 'texto livre com PII',
      },
    ]);
    const r = await get('?patient_id=p1&include_financials=true');
    expect(r.status).toBe(200);
    const raw = await r.text();
    expect(raw).not.toContain('notes');
    expect(raw).not.toContain('texto livre');
    const summary = JSON.parse(raw).data.financial_summary;
    expect(summary.plans[0].payments).toEqual([
      {
        id: 'pay-1',
        budget_id: 'b-1',
        amount: 400,
        payment_method: 'pix',
        paid_at: '2026-09-01T10:00:00.000Z',
      },
    ]);
  });
});
