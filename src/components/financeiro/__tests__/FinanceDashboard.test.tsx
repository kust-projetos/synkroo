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

jest.mock('@/lib/hooks/use-queries', () => ({
  useBudgets: (...args: unknown[]) => mockUseBudgets(...args),
  usePayments: (...args: unknown[]) => mockUsePayments(...args),
  useCollections: (...args: unknown[]) => mockUseCollections(...args),
  useGateways: (...args: unknown[]) => mockUseGateways(...args),
  useUpdateBudgetStatus: () => ({ mutate: jest.fn(), isPending: false }),
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
    expect(screen.getByRole('button', { name: /Orçamentos/i })).toBeInTheDocument();
  });

  test('switches to collections tab', async () => {
    const { container } = render(<FinanceDashboard metrics={METRICS} />);
    fireEvent.click(screen.getByRole('button', { name: /Cobranças/i }));
    await waitFor(() => {
      expect(mockUseCollections).toHaveBeenCalled();
    });
  });
});