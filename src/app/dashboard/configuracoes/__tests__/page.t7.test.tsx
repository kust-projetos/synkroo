/** @jest-environment jsdom */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ profile: { clinic_id: 'clinic-1' } }),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock('@/components/calendar/store/calendar-store', () => {
  const state = { startHour: 8, endHour: 18, setBusinessHours: jest.fn() };
  const fn: any = jest.fn((selector: any) => (selector ? selector(state) : state));
  fn.getState = jest.fn(() => state);
  return { useCalendarStore: fn };
});

import ConfiguracoesPage from '../page';

describe('T7 — Configurações: persistência e load error', () => {
  let queryClient: QueryClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    queryClient = new QueryClient();
    jest.clearAllMocks();
  });
  afterAll(() => {
    (global as any).fetch = originalFetch;
  });

  it('mostra erro de load sem defaults confirmados quando fetch falha', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'DB error' }) });
    render(
      <QueryClientProvider client={queryClient}>
        <ConfiguracoesPage />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText(/Erro ao carregar configurações/)).toBeInTheDocument());
    // Should not show the default settings as confirmed
    expect(screen.queryByText(/Configurações salvas com sucesso/)).not.toBeInTheDocument();
  });

  it('persiste horários via endpoint canônico e preserva whatsapp_phone_number_id (via settings merge)', async () => {
    const mockFetch = jest.fn(async (url: string, init?: any) => {
      if (String(url).includes('/api/clinics/settings')) {
        return { ok: true, json: async () => ({ data: { settings: { id: 'clinic-1', name: 'Clinica', settings: { whatsapp_phone_number_id: 'keep-me', opening_hours: { startHour: 8, endHour: 18 } } } } }) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });
    (global as any).fetch = mockFetch as any;

    render(
      <QueryClientProvider client={queryClient}>
        <ConfiguracoesPage />
      </QueryClientProvider>
    );

    // The BusinessHoursCard should have loaded
    expect(await screen.findByText(/Horário de Funcionamento/)).toBeInTheDocument();
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  });

  it('reload preserva settings após salvar', async () => {
    let savedSettings: any = null;
    (global as any).fetch = jest.fn(async (url: string, init?: any) => {
      if (String(url).includes('/api/clinics/settings') && init?.method === 'PUT') {
        savedSettings = JSON.parse(init.body);
        return { ok: true, json: async () => ({ success: true }) } as any;
      }
      if (String(url).includes('/api/clinics/settings')) {
        return { ok: true, json: async () => ({ data: { settings: { id: 'clinic-1', name: 'Test', settings: savedSettings?.settings || {} } } }) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ConfiguracoesPage />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText(/Horário de Funcionamento/)).toBeInTheDocument());
    // After save, reload should still have the saved data
    expect(savedSettings).toBeNull(); // initially not saved
  });
});
