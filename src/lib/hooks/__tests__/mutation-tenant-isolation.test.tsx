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
  invalidateCalendarDateKeys,
  invalidateClinicDomain,
  invalidateDomainAllTenants,
  useCreateTask,
} from '@/lib/hooks/use-queries';
import { useCreateTreatmentPlan } from '@/hooks/useTreatmentPlans';
import { useRecordPayment } from '@/hooks/usePayments';
import { useSendWhatsAppMessage } from '@/lib/hooks/use-whatsapp-messages';
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

  it('useRecordPayment: invalidação exata do budget + derivados, sem predicate amplo', async () => {
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

    // G1: key canônica exata do budget + derivado do dashboard.
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['clinic', 'clinic-A', 'financeiro', 'payments', 'b-1'],
    });
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['clinic', 'clinic-A', 'financeiro', 'dashboard'],
    });
    // Derivado financial-summary: domínio da clínica (patientId indisponível na mutation).
    const domainCall = spy.mock.calls.find(
      (c) => typeof (c[0] as { predicate?: unknown })?.predicate === 'function',
    );
    expect(domainCall).toBeDefined();
    const predicate = (domainCall![0] as { predicate: (q: any) => boolean }).predicate;
    expect(predicate({ queryKey: ['clinic', 'clinic-A', 'financial-summary', 'p-1'] })).toBe(true);
    expect(predicate({ queryKey: ['clinic', 'clinic-B', 'financial-summary', 'p-1'] })).toBe(false);
    expect(predicate({ queryKey: ['clinic', 'clinic-A', 'financeiro', 'dashboard'] })).toBe(false);
  });

  it('useSendWhatsAppMessage sem contactId e com tenant: escopado à clínica', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'msg-1', status: 'sent' }),
    });
    const qc = makeClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useSendWhatsAppMessage({ contactPhone: '+5511999999999' }), {
      wrapper: wrapper(qc, 'clinic-A'),
    });

    await act(async () => {
      await result.current.mutateAsync({ message: 'olá' });
    });

    const predicate = capturedPredicate(spy);
    expect(predicate({ queryKey: ['clinic', 'clinic-A', 'whatsapp-messages', 'c-1'] })).toBe(true);
    expect(predicate({ queryKey: ['clinic', 'clinic-B', 'whatsapp-messages', 'c-9'] })).toBe(false);
    expect(predicate({ queryKey: ['clinic', 'clinic-A', 'contacts', 'c-1'] })).toBe(false);
  });

  it('useSendWhatsAppMessage sem contactId nem tenant: fallback amplo-por-domínio', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'msg-2', status: 'sent' }),
    });
    const qc = makeClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useSendWhatsAppMessage({ contactPhone: '+5511999999999' }), {
      wrapper: wrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ message: 'olá' });
    });

    const predicate = capturedPredicate(spy);
    expect(predicate({ queryKey: ['clinic', 'clinic-B', 'whatsapp-messages', 'c-9'] })).toBe(true);
    expect(predicate({ queryKey: ['clinic', 'clinic-A', 'contacts', 'c-1'] })).toBe(false);
  });

  it('useSendWhatsAppMessage com contactId: invalidação exata da key', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'msg-3', status: 'sent' }),
    });
    const qc = makeClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(
      () => useSendWhatsAppMessage({ contactPhone: '+5511999999999', contactId: 'c-1' }),
      {
        wrapper: wrapper(qc, 'clinic-A'),
      },
    );

    await act(async () => {
      await result.current.mutateAsync({ message: 'olá' });
    });

    // G1: caminho quente — key exata, sem predicate de domínio.
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['clinic', 'clinic-A', 'whatsapp-messages', 'c-1'],
    });
  });
});

describe('G1 — invalidateCalendarDateKeys (validação estrita, fallback conservador)', () => {
  // Monta a qs como useCalendarEvents: clinic_id + start_date + end_date (+ filtros).
  const qs = (start: string, end: string) =>
    new URLSearchParams({ clinic_id: 'clinic-A', start_date: start, end_date: end }).toString();
  const calKey = (clinic: string, q: unknown) => ({ queryKey: ['clinic', clinic, 'calendar-events', q] });

  function runPredicate(qc: QueryClient, clinicId: string | undefined, ...dates: string[]) {
    const spy = jest.spyOn(qc, 'invalidateQueries');
    invalidateCalendarDateKeys(qc, clinicId, ...dates);
    const call = spy.mock.calls[0]?.[0] as { predicate?: (q: any) => boolean };
    expect(typeof call?.predicate).toBe('function');
    return call.predicate!;
  }

  it('(a) faixa válida que contém a data afetada → true', () => {
    const predicate = runPredicate(makeClient(), 'clinic-A', '2026-09-14');
    expect(predicate(calKey('clinic-A', qs('2026-09-01', '2026-09-30')))).toBe(true);
  });

  it('(b) faixa válida sem sobreposição → false', () => {
    const predicate = runPredicate(makeClient(), 'clinic-A', '2026-10-05');
    expect(predicate(calKey('clinic-A', qs('2026-09-01', '2026-09-30')))).toBe(false);
  });

  it('(c) faixa com datas inválidas → true (nunca stale)', () => {
    const predicate = runPredicate(makeClient(), 'clinic-A', '2026-09-14');
    // Texto livre parseável mas fora do formato/calendário.
    expect(predicate(calKey('clinic-A', 'start_date=invalid&end_date=invalid'))).toBe(true);
    // Formato ok, calendário impossível (rollover silencioso do Date).
    expect(predicate(calKey('clinic-A', qs('2026-02-30', '2026-03-02')))).toBe(true);
    // Faixa invertida.
    expect(predicate(calKey('clinic-A', qs('2026-09-30', '2026-09-01')))).toBe(true);
  });

  it('(d) params ausentes → true', () => {
    const predicate = runPredicate(makeClient(), 'clinic-A', '2026-09-14');
    expect(predicate(calKey('clinic-A', 'clinic_id=clinic-A'))).toBe(true);
    expect(predicate(calKey('clinic-A', ''))).toBe(true);
  });

  it('(e) data afetada inválida → true', () => {
    const predicate = runPredicate(makeClient(), 'clinic-A', 'not-a-date');
    expect(predicate(calKey('clinic-A', qs('2026-09-01', '2026-09-30')))).toBe(true);
  });

  it('(f) outro tenant ou outro domínio → false', () => {
    const predicate = runPredicate(makeClient(), 'clinic-A', '2026-09-14');
    expect(predicate(calKey('clinic-B', qs('2026-09-01', '2026-09-30')))).toBe(false);
    expect(
      predicate({ queryKey: ['clinic', 'clinic-A', 'appointments', 'date=2026-09-14'] }),
    ).toBe(false);
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
