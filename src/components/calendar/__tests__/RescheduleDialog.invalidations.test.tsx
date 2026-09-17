/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CalendarEvent } from '../utils/types';

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
    useDentists: () => ({ data: { dentists: [{ id: 'd-1', name: 'Dra. Ana' }] } }),
  };
});
jest.mock('@/lib/ui/toast', () => ({
  useToast: () => ({ showToast: mockToast }),
}));
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mockInvalidate }) };
});

const originalFetch = global.fetch;

import { RescheduleDialog } from '../RescheduleDialog';

const EVENTS: CalendarEvent[] = [
  {
    id: 'evt-1',
    title: 'Paciente Teste',
    start: new Date(2026, 8, 10, 10, 0),
    end: new Date(2026, 8, 10, 10, 30),
    dentistId: 'd-1',
    dentistName: 'Dra. Ana',
    procedureName: 'Limpeza',
    status: 'scheduled',
    durationMinutes: 30,
  },
];

describe('Etapa 1 — RescheduleDialog invalidations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient();
    const mockState = {
      dialog: {
        open: true,
        mode: 'reschedule',
        rescheduleInfo: {
          eventId: 'evt-1',
          targetDateKey: '2026-09-12',
          originalHour: 10,
          originalMinute: 0,
        },
      },
      closeDialog: mockCloseDialog,
    };
    const { useCalendarStore } = require('../store/calendar-store');
    (useCalendarStore as jest.Mock).mockImplementation((selector?: any) => (selector ? selector(mockState) : mockState));
    (global as any).fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) }) as any);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('sucesso invalida calendário (origem+destino), coleção, detalhe e dashboard', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RescheduleDialog events={EVENTS} />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Reagendamento/ }));

    await waitFor(() => expect(mockCloseDialog).toHaveBeenCalled());
    expect(mockToast).toHaveBeenCalledWith('Agendamento remarcado com sucesso!', 'success');

    const predCalls = mockInvalidate.mock.calls.filter((c: any) => c[0]?.predicate);
    const matches = (key: unknown[]) => predCalls.some((c: any) => c[0].predicate({ queryKey: key }));

    // Coleção de appointments da clínica (escopada; sem vazamento cross-tenant).
    expect(matches(['clinic', 'clinic-1', 'appointments', 'status=scheduled'])).toBe(true);
    expect(matches(['clinic', 'clinic-OTHER', 'appointments', 'status=scheduled'])).toBe(false);
    // Faixas de calendário contendo origem (2026-09-10) e destino (2026-09-12).
    expect(matches(['clinic', 'clinic-1', 'calendar-events', 'start_date=2026-09-01&end_date=2026-09-30'])).toBe(true);
    expect(matches(['clinic', 'clinic-1', 'calendar-events', 'start_date=2026-01-01&end_date=2026-01-31'])).toBe(false);
    // Dashboard da clínica.
    expect(matches(['clinic', 'clinic-1', 'dashboard', 'stats'])).toBe(true);
    // Detalhe exato do agendamento.
    expect(mockInvalidate).toHaveBeenCalledWith({
      queryKey: ['clinic', 'clinic-1', 'appointments', 'evt-1'],
    });
  });

  it('falha não fecha o modal nem invalida', async () => {
    (global as any).fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({ error: 'conflito de horario' }),
    }) as any);

    render(
      <QueryClientProvider client={queryClient}>
        <RescheduleDialog events={EVENTS} />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Reagendamento/ }));

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockCloseDialog).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
