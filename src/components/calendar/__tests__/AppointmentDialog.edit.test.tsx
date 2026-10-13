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

const originalFetch = global.fetch;

import { AppointmentDialog } from '../AppointmentDialog';

const EDIT_ID = 'appt-edit-1';

function setupFetchMock() {
  const calls: { url: string; init?: any }[] = [];
  const mockFetch = jest.fn(async (url: string, init?: any) => {
    calls.push({ url, init });
    if (typeof url === 'string' && url.includes('/api/patients?search=')) {
      return { ok: true, json: async () => ({ patients: [] }) } as any;
    }
    if (typeof url === 'string' && url.includes('/api/patients') && init?.method === 'POST') {
      return { ok: true, json: async () => ({ patient: { id: 'patient-1' } }) } as any;
    }
    // Edit prefill: GET appointment by id
    if (url === `/api/appointments/${EDIT_ID}` && (!init || !init.method || init.method === 'GET')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            appointment: {
              id: EDIT_ID,
              patientId: 'patient-1',
              dentistId: null,
              procedureId: null,
              scheduledAt: '2026-09-10T10:00:00.000Z',
              durationMinutes: 30,
              status: 'scheduled',
              notes: null,
              patient: { id: 'patient-1', name: 'Maria Silva', phone: '11999990000' },
            },
          },
        }),
      } as any;
    }
    // Edit save: PUT appointment by id
    if (url === `/api/appointments/${EDIT_ID}` && init?.method === 'PUT') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { appointment: { id: EDIT_ID } } }),
      } as any;
    }
    // Create save: POST collection
    if (url === '/api/appointments' && init?.method === 'POST') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { appointment: { id: 'appt-new' } } }),
      } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  });
  (global as any).fetch = mockFetch;
  return { mockFetch, calls };
}

function mockDialogState(dialog: any) {
  const mockState = { dialog, closeDialog: mockCloseDialog, clearPrefill: jest.fn() };
  const { useCalendarStore } = require('../store/calendar-store');
  (useCalendarStore as jest.Mock).mockImplementation((selector?: any) =>
    selector ? selector(mockState) : mockState,
  );
  (useCalendarStore as any).getState = jest.fn(() => ({ clearPrefill: jest.fn() }));
}

describe('AppointmentDialog create vs edit', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('create salva via POST na coleção (sem PUT, sem id na URL)', async () => {
    const { calls } = setupFetchMock();
    mockDialogState({
      open: true,
      mode: 'create',
      slotInfo: { date: new Date('2026-09-10'), hour: 10, minute: 0 },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <AppointmentDialog />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText('Nome do paciente'), {
      target: { value: 'Novo Paciente' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Agendar|Salvar/ }));

    await waitFor(() => expect(mockCloseDialog).toHaveBeenCalled());
    const postCollection = calls.filter((c) => c.url === '/api/appointments' && c.init?.method === 'POST');
    expect(postCollection).toHaveLength(1);
    expect(JSON.parse(postCollection[0].init.body)).toMatchObject({ patient_id: 'patient-1' });
    expect(calls.some((c) => c.init?.method === 'PUT')).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Agendamento criado' }));
  });

  it('edit salva via PUT com id (sem POST na coleção — sem duplicata)', async () => {
    const { calls } = setupFetchMock();
    mockDialogState({ open: true, mode: 'edit', eventId: EDIT_ID });
    render(
      <QueryClientProvider client={queryClient}>
        <AppointmentDialog />
      </QueryClientProvider>,
    );

    // Prefill via GET deve popular o nome do paciente
    const nameInput = screen.getByPlaceholderText('Nome do paciente') as HTMLInputElement;
    await waitFor(() => expect(nameInput.value).toBe('Maria Silva'));

    fireEvent.click(screen.getByRole('button', { name: /Agendar|Salvar/ }));

    await waitFor(() => expect(mockCloseDialog).toHaveBeenCalled());
    const puts = calls.filter((c) => c.url === `/api/appointments/${EDIT_ID}` && c.init?.method === 'PUT');
    expect(puts).toHaveLength(1);
    // PUT usa o schema camelCase do atualizarConsulta
    expect(JSON.parse(puts[0].init.body)).toMatchObject({
      patientId: 'patient-1',
      durationMinutes: 30,
    });
    expect(
      calls.some((c) => c.url === '/api/appointments' && c.init?.method === 'POST'),
    ).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Agendamento atualizado' }),
    );
  });
});
