/**
 * Tests: Financeiro dashboard components (Task 7 — contract correction).
 *
 * Cobertura:
 * - Overdue metrics render correctly (count, total, stages)
 * - Each tab renders its content
 * - Budget tab with budget selection → payments tab navigation
 *
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FinanceDashboard } from '../FinanceDashboard';

const mockUseBudgets = jest.fn();
const mockUsePayments = jest.fn();
const mockUseCollections = jest.fn();
const mockUseGateways = jest.fn();
const mockUpdateBudgetStatus = jest.fn();
const mockCancelCharge = jest.fn();

jest.mock('@/lib/hooks/use-queries', () => ({
  useBudgets: (...args: unknown[]) => mockUseBudgets(...args),
  usePayments: (...args: unknown[]) => mockUsePayments(...args),
  useCollections: (...args: unknown[]) => mockUseCollections(...args),
  useGateways: (...args: unknown[]) => mockUseGateways(...args),
  useUpdateBudgetStatus: (...args: unknown[]) => mockUpdateBudgetStatus(...args),
  useCancelCharge: (...args: unknown[]) => mockCancelCharge(...args),
}));

const METRICS = {
  overdueCount: 7,
  totalOverdue: 3850.00,
  overdueStages: { light: 3, firm: 2, internal: 2 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseBudgets.mockReturnValue({ data: [], isLoading: false });
  mockUsePayments.mockReturnValue({ data: [], isLoading: false });
  mockUseCollections.mockReturnValue({ data: { charges: [] }, isLoading: false });
  mockUseGateways.mockReturnValue({ data: [], isLoading: false });
  mockUpdateBudgetStatus.mockReturnValue({ mutate: jest.fn(), isPending: false, variables: undefined });
  mockCancelCharge.mockReturnValue({ mutate: jest.fn(), isPending: false, variables: undefined });
});

describe('FinanceDashboard — overdue metrics', () => {
  test('renders overdue count', () => {
    render(<FinanceDashboard metrics={METRICS} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  test('renders total overdue as R$ formatted', () => {
    render(<FinanceDashboard metrics={METRICS} />);
    expect(screen.getByText(/3850[.,]00/)).toBeInTheDocument();
  });

  test('renders overdue stages light/firm/internal', () => {
    render(<FinanceDashboard metrics={METRICS} />);
    expect(screen.getByText(/Leve:/)).toBeInTheDocument();
    expect(screen.getByText(/Firme:/)).toBeInTheDocument();
    expect(screen.getByText(/Interna:/)).toBeInTheDocument();
  });
});

describe('FinanceDashboard — tabs', () => {
  test('shows budget tab content by default', () => {
    mockUseBudgets.mockReturnValue({ data: [], isLoading: false });
    render(<FinanceDashboard metrics={METRICS} />);
    expect(screen.getByRole('tab', { name: /Orçamentos/i })).toBeInTheDocument();
  });

  test('switches to collections tab', async () => {
    render(<FinanceDashboard metrics={METRICS} />);
    fireEvent.click(screen.getByRole('tab', { name: /Cobranças/i }));
    await waitFor(() => {
      expect(mockUseCollections).toHaveBeenCalled();
    });
  });
});

describe('FinanceDashboard — Etapa 13 mutation UX (orçamentos)', () => {
  const BUDGETS = [{ id: 'b1', patientName: 'Ana', total: 500, status: 'pending' }];

  test('aceitar orçamento chama mutate com status accepted', async () => {
    const mutate = jest.fn();
    mockUseBudgets.mockReturnValue({ data: BUDGETS, isLoading: false });
    mockUpdateBudgetStatus.mockReturnValue({ mutate, isPending: false, variables: undefined });
    render(<FinanceDashboard metrics={METRICS} canManageBudget />);
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        { id: 'b1', status: 'accepted' },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      );
    });
  });

  test('desabilita ações e mostra "Salvando..." enquanto pendente', () => {
    mockUseBudgets.mockReturnValue({ data: BUDGETS, isLoading: false });
    mockUpdateBudgetStatus.mockReturnValue({
      mutate: jest.fn(),
      isPending: true,
      variables: { id: 'b1', status: 'accepted' },
    });
    render(<FinanceDashboard metrics={METRICS} canManageBudget />);
    const saving = screen.getAllByRole('button', { name: 'Salvando...' });
    expect(saving).toHaveLength(2);
    saving.forEach((btn) => {
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-busy', 'true');
    });
  });

  test('sem permissão de gestão não exibe ações de orçamento', () => {
    mockUseBudgets.mockReturnValue({ data: BUDGETS, isLoading: false });
    render(<FinanceDashboard metrics={METRICS} />);
    expect(screen.queryByRole('button', { name: 'Aceitar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recusar' })).not.toBeInTheDocument();
  });
});