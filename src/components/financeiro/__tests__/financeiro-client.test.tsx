/**
 * @jest-environment jsdom
 *
 * financeiro-client.test.tsx (Task 7 contract correction).
 *
 * Tests that FinanceiroDashboardClient uses useFinanceDashboard
 * with contract {overdueCount, totalOverdue, overdueStages}.
 * Collections charges são gerenciadas pelo próprio CollectionTab.
 */

const mockUseFinanceDashboard = jest.fn();
const mockUseBudgets = jest.fn();
const mockUseCollections = jest.fn();
const mockUseGateways = jest.fn();

jest.mock('@/lib/hooks/use-queries', () => ({
  useFinanceDashboard: (...args: unknown[]) => mockUseFinanceDashboard(...args),
  useBudgets: (...args: unknown[]) => mockUseBudgets(...args),
  useCollections: (...args: unknown[]) => mockUseCollections(...args),
  useGateways: (...args: unknown[]) => mockUseGateways(...args),
}));

jest.mock('@/components/financeiro/FinanceDashboard', () => ({
  FinanceDashboard: jest.fn(({ metrics, canManageBudget }) => (
    <div data-testid="finance-dashboard">
      <span data-testid="metrics">{JSON.stringify(metrics)}</span>
      <span data-testid="can-manage">{String(canManageBudget)}</span>
    </div>
  )),
}));

jest.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}));

jest.mock('@/lib/auth/context', () => ({
  useAuth: jest.fn(() => ({ profile: { role: 'owner', clinic_id: 'c1', name: 'Test Owner' } })),
}));

const DASHBOARD_FIXTURE = {
  overdueCount: 7,
  totalOverdue: 3850.00,
  overdueStages: { light: 3, firm: 2, internal: 2 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFinanceDashboard.mockReturnValue({ data: DASHBOARD_FIXTURE, isLoading: false });
  mockUseBudgets.mockReturnValue({ data: [], isLoading: false });
  mockUseCollections.mockReturnValue({ data: { charges: [] }, isLoading: false });
  mockUseGateways.mockReturnValue({ data: [], isLoading: false });
});

import { render, screen } from '@testing-library/react';
import { FinanceiroDashboardClient } from '@/app/dashboard/financeiro/financeiro-client';

describe('FinanceiroDashboardClient — useFinanceDashboard', () => {
  it('usa useFinanceDashboard para dados de dashboard', () => {
    render(<FinanceiroDashboardClient />);
    expect(mockUseFinanceDashboard).toHaveBeenCalled();
  });

  it('passa dashboard data real (overdueCount, totalOverdue, stages) para FinanceDashboard', () => {
    render(<FinanceiroDashboardClient />);
    const metricsEl = screen.getByTestId('metrics');
    const metrics = JSON.parse(metricsEl.textContent ?? '{}');
    expect(metrics.overdueCount).toBe(7);
    expect(metrics.totalOverdue).toBe(3850.00);
    expect(metrics.overdueStages.light).toBe(3);
    expect(metrics.overdueStages.firm).toBe(2);
    expect(metrics.overdueStages.internal).toBe(2);
  });

  it('usa valores padrão (0) quando hook retorna undefined', () => {
    mockUseFinanceDashboard.mockReturnValue({ data: undefined, isLoading: false });
    render(<FinanceiroDashboardClient />);
    const metricsEl = screen.getByTestId('metrics');
    const metrics = JSON.parse(metricsEl.textContent ?? '{}');
    expect(metrics.overdueCount).toBe(0);
    expect(metrics.totalOverdue).toBe(0);
    expect(metrics.overdueStages.light).toBe(0);
  });

  it('renderiza erro quando useFinanceDashboard retorna error (não zero-summary)', () => {
    mockUseFinanceDashboard.mockReturnValue({ data: undefined, isLoading: false, error: new Error('API failure') });
    render(<FinanceiroDashboardClient />);
    expect(screen.getByRole('heading', { name: /erro/i })).toBeInTheDocument();
    expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument();
    // NÃO renderiza métricas (FinanceDashboard) quando há erro
    expect(screen.queryByTestId('finance-dashboard')).not.toBeInTheDocument();
  });

  it('renderiza PageHeader com título Financeiro', () => {
    render(<FinanceiroDashboardClient />);
    expect(screen.getByText('Financeiro')).toBeInTheDocument();
  });
});