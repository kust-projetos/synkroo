/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCloseDialog = jest.fn();
const mockToast = jest.fn();
const mockInvalidate = jest.fn();
const mockProfile = { clinic_id: 'clinic-1' };

jest.mock('../store/calendar-store', () => ({
  useCalendarStore: jest.fn(),
}));
jest.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ profile: mockProfile }),
}));
jest.mock('@/lib/hooks/use-queries', () => {
  // G1: mantém os helpers reais (clinicScope, invalidateCalendarDateKeys);
  // só as queries de catálogo são herméticas.
  const actual = jest.requireActual('@/lib/hooks/use-queries');
  return {
    ...actual,
    useDentists: () => ({ data: { dentists: [] } }),
    useProcedures: () => ({ data: { procedures: [] } }),
  };
});
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mockInvalidate }) };
});

// Need to mock fetch globally
const originalFetch = global.fetch;

import { AppointmentDialog } from '../AppointmentDialog';

function setupFetchMocks(scenario: 'success' | '409' | '500') {
  const mockFetch = jest.fn(async (url: string, init?: any) => {
    if (typeof url === 'string' && url.includes('/api/patients?search=')) {
      return { ok: true, json: async () => ({ patients: [] }) } as any;
    }
    if (typeof url === 'string' && url.includes('/api/patients') && init?.method === 'POST') {
      return { ok: true, json: async () => ({ patient: { id: 'patient-1' } }) } as any;
    }
    if (typeof url === 'string' && url.includes('/api/appointments')) {
      if (scenario === '409') {
        return { ok: false, status: 409, json: async () => ({ error: 'Horário já ocupado' }) } as any;
      }
      if (scenario === '500') {
        return { ok: false, status: 500, json: async () => ({ error: 'Erro interno' }) } as any;
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  });
  (global as any).fetch = mockFetch;
  return mockFetch;
}

describe('T6 — AppointmentDialog response.ok/envelope', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient();
    mockCloseDialog.mockClear();
    mockToast.mockClear();
    mockInvalidate.mockClear();
    const mockState = {
      dialog: { open: true, mode: 'create', slotInfo: { date: new Date('2026-09-10'), hour: 10, minute: 0 } },
      closeDialog: mockCloseDialog,
      clearPrefill: jest.fn(),
    };
    const { useCalendarStore } = require('../store/calendar-store');
    (useCalendarStore as jest.Mock).mockImplementation((selector?: any) => (selector ? selector(mockState) : mockState));
    (useCalendarStore as any).getState = jest.fn(() => ({ clearPrefill: jest.fn() }));
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('409 mantém modal aberto, mostra toast e não invalida', async () => {
    setupFetchMocks('409');
    render(
      <QueryClientProvider client={queryClient}>
        <AppointmentDialog />
      </QueryClientProvider>
    );

    // Fill required fields
    const nameInput = screen.getByPlaceholderText('Nome do paciente');
    fireEvent.change(nameInput, { target: { value: 'Test Patient' } });

    const saveBtn = screen.getByRole('button', { name: /Agendar|Salvar/ });
    fireEvent.click(saveBtn);

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Horário já ocupado' })));
    expect(mockCloseDialog).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('500 mantém modal aberto e mostra toast', async () => {
    setupFetchMocks('500');
    render(
      <QueryClientProvider client={queryClient}>
        <AppointmentDialog />
      </QueryClientProvider>
    );
    const nameInput = screen.getByPlaceholderText('Nome do paciente');
    fireEvent.change(nameInput, { target: { value: 'Test Patient' } });
    fireEvent.click(screen.getByRole('button', { name: /Agendar|Salvar/ }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao agendar' })));
    expect(mockCloseDialog).not.toHaveBeenCalled();
  });

  it('200 fecha modal e invalida apenas após sucesso', async () => {
    setupFetchMocks('success');
    render(
      <QueryClientProvider client={queryClient}>
        <AppointmentDialog />
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByPlaceholderText('Nome do paciente'), { target: { value: 'Test Patient' } });
    fireEvent.click(screen.getByRole('button', { name: /Agendar|Salvar/ }));
    await waitFor(() => expect(mockCloseDialog).toHaveBeenCalled());
    expect(mockInvalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['clinic', 'clinic-1', 'appointments'] }),
    );
    // G1: calendar-events refinado por sobreposição de faixa (predicate), não mais prefixo.
    expect(mockInvalidate).toHaveBeenCalledWith(
      expect.objectContaining({ predicate: expect.any(Function) }),
    );
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Agendamento criado' }));
  });
});
