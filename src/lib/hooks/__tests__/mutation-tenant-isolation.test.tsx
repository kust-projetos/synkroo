/**
 * @jest-environment jsdom
 *
 * R4 — isolamento de invalidação de mutation por clínica.
 *
 * Prova que mutations invalidadas via helpers (`invalidateClinicDomain` /
 * `invalidateClinicKeys`) atingem só o tenant atual, e documenta o fallback
 * amplo-por-domínio (`invalidateDomainAllTenants`) usado quando a mutation
 * não carrega o tenant em contexto, retorno ou variáveis.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  invalidateClinicDomain,
  invalidateDomainAllTenants,
  useCreateTask,
} from '@/lib/hooks/use-queries';
import { useCreateTreatmentPlan } from '@/hooks/useTreatmentPlans';
import { useRecordPayment } from '@/hooks/usePayments';
import { AuthContext } from '@/lib/auth/context';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapper(qc: QueryClient, clinicId?: string) {
  return ({ children }: { children: React.ReactNode }) => {
    const inner =
      clinicId != null ? (
        <AuthContext.Provider value={{ profile: { clinic_id: clinicId } } as any}>
          {children}
        </AuthContext.Provider>
      ) : (
        <>{children}</>
      );
    return <QueryClientProvider client={qc}>{inner}</QueryClientProvider>;
  };
}

function capturedPredicate(spy: jest.SpyInstance) {
  const call = spy.mock.calls[0]?.[0] as { predicate?: (q: any) => boolean };
  expect(typeof call?.predicate).toBe('function');
  return call.predicate!;
}

beforeEach(() => {
  (global.fetch as unknown) = jest.fn();
  delete process.env.NEXT_PUBLIC_USE_MOCKS;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('R4 — mutation escopada atinge só o tenant atual', () => {
  it('useCreateTask com tenant no contexto: invalida tasks da clínica A, não da B', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { task: { id: 't-1' } } }),
    });
    const qc = makeClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateTask(), {
      wrapper: wrapper(qc, 'clinic-A'),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: 'Task A', priority: 'high' });
    });

    const predicate = capturedPredicate(spy);
    // Dentro do tenant: continua atingindo (zero mudança de correção).
    expect(predicate({ queryKey: ['clinic', 'clinic-A', 'tasks', { status: 'pending' }] })).toBe(true);
    // Isolamento: não atravessa para outra clínica…
    expect(predicate({ queryKey: ['clinic', 'clinic-B', 'tasks', { status: 'pending' }] })).toBe(false);
    // …nem para outro domínio da mesma clínica.
    expect(predicate({ queryKey: ['clinic', 'clinic-A', 'patients', 'page=1'] })).toBe(false);
  });

  it('useCreateTreatmentPlan deriva o tenant das variáveis (clinic_id do input)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { treatment_plan: { id: 'tp-1', clinic_id: 'clinic-1', patient_id: 'pat-100' } },
      }),
    });
    const qc = makeClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    // Sem provider: o tenant vem de variables.clinic_id.
    const { result } = renderHook(() => useCreateTreatmentPlan(), {
      wrapper: wrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        clinic_id: 'clinic-1',
        patient_id: 'pat-100',
        title: 'Prótese',
        total_sessions: 1,
        items: [],
      } as any);
    });

    const predicate = capturedPredicate(spy);
    expect(predicate({ queryKey: ['clinic', 'clinic-1', 'treatment-plans', 'pat-100'] })).toBe(true);
    expect(predicate({ queryKey: ['clinic', 'clinic-2', 'treatment-plans', 'pat-100'] })).toBe(false);
    expect(predicate({ queryKey: ['clinic', 'clinic-1', 'treatment-plans', 'other'] })).toBe(false);
  });

  it('useRecordPayment com tenant no contexto: match por budget_id restrito à clínica', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'pay-1', budget_id: 'b-1' } }),
    });
    const qc = makeClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRecordPayment(), {
      wrapper: wrapper(qc, 'clinic-A'),
    });

    await act(async () => {
      await result.current.mutateAsync({ budget_id: 'b-1', amount: 50, payment_method: 'pix' });
    });

    const predicate = capturedPredicate(spy);
    expect(predicate({ queryKey: ['clinic', 'clinic-A', 'payments', 'b-1'] })).toBe(true);
    expect(predicate({ queryKey: ['clinic', 'clinic-B', 'payments', 'b-1'] })).toBe(false);
    expect(predicate({ queryKey: ['clinic', 'clinic-A', 'payments', 'b-9'] })).toBe(false);
  });
});

describe('R4 — fallback amplo-por-domínio (tenant indisponível)', () => {
  it('useCreateTask sem tenant: preserva alcance antigo dentro do domínio, sem vazar de domínio', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { task: { id: 't-9' } } }),
    });
    const qc = makeClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateTask(), {
      wrapper: wrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: 'Task', priority: 'low' });
    });

    const predicate = capturedPredicate(spy);
    // Documentado: sem tenant, o alcance antigo é preservado (qualquer
    // tenant, só o domínio) em vez de silenciosamente não invalidar nada.
    expect(predicate({ queryKey: ['clinic', 'clinic-Z', 'tasks', {}] })).toBe(true);
    expect(predicate({ queryKey: ['clinic', 'clinic-Z', 'patients', 'x'] })).toBe(false);
    expect(predicate({ queryKey: ['other', 'tasks'] })).toBe(false);
  });

  it('invalidateClinicDomain escopa por prefixo [clinic, tenant, ...domain]', () => {
    const qc = makeClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    invalidateClinicDomain(qc, 'clinic-A', 'financeiro', 'budgets');
    const predicate = capturedPredicate(spy);
    expect(predicate({ queryKey: ['clinic', 'clinic-A', 'financeiro', 'budgets'] })).toBe(true);
    expect(predicate({ queryKey: ['clinic', 'clinic-B', 'financeiro', 'budgets'] })).toBe(false);
    expect(predicate({ queryKey: ['clinic', 'clinic-A', 'financeiro', 'dashboard'] })).toBe(false);
  });

  it('invalidateDomainAllTenants restringe ao domínio (key[2]) em qualquer tenant', () => {
    const qc = makeClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    invalidateDomainAllTenants(qc, 'whatsapp-messages');
    const predicate = capturedPredicate(spy);
    expect(predicate({ queryKey: ['clinic', 'clinic-A', 'whatsapp-messages', 'c-1'] })).toBe(true);
    expect(predicate({ queryKey: ['clinic', 'clinic-B', 'whatsapp-messages', 'c-9'] })).toBe(true);
    expect(predicate({ queryKey: ['clinic', 'clinic-A', 'contacts', 'c-1'] })).toBe(false);
  });
});
