/**
 * financeiro-client.tsx (Task 7 contract correction)
 *
 * Client component that wraps the FinanceiroDashboard with live hooks.
 * Fetches overdue summary via useFinanceDashboard (GET /api/financeiro/dashboard).
 * Contract: {overdueCount, totalOverdue, overdueStages:{light,firm,internal}}.
 * Collections tab fetches its own data via useCollections.
 */
'use client';

import { useFinanceDashboard } from '@/lib/hooks/use-queries';
import { FinanceDashboard } from '@/components/financeiro/FinanceDashboard';
import { PageHeader } from '@/components/ui/page-header';

export function FinanceiroDashboardClient() {
  const { data, isLoading, error } = useFinanceDashboard();

  // Erro do dashboard deve renderizar estado de erro, não zero-summary.
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Financeiro"
          description="Gestão de orçamentos, pagamentos e cobranças"
        />
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
            <h3 className="text-lg font-semibold">Erro no Dashboard</h3>
            <p className="mt-2 text-sm">
              Não foi possível carregar os dados do dashboard financeiro. Tente novamente mais tarde.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const dashboardData = (data as {
    overdueCount?: number;
    totalOverdue?: number;
    overdueStages?: { light: number; firm: number; internal: number };
  }) ?? {};

  const metrics = {
    overdueCount: dashboardData.overdueCount ?? 0,
    totalOverdue: dashboardData.totalOverdue ?? 0,
    overdueStages: dashboardData.overdueStages ?? { light: 0, firm: 0, internal: 0 },
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Financeiro"
        description="Gestão de orçamentos, pagamentos e cobranças"
      />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <FinanceDashboard metrics={metrics} canManageBudget={false} />
      </div>
    </div>
  );
}