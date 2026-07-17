'use client';

import { useAuth } from '@/lib/auth/context';
import { FinanceDashboard } from '@/components/financeiro/FinanceDashboard';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';

/**
 * Financeiro dashboard page.
 *
 * Shows financial metrics, budget/payment/collection management,
 * and gateway configuration tabs.
 */
export default function FinanceiroDashboardPage() {
  const { profile } = useAuth();
  const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin';

  // Page-level permission check
  const canManageBudget = !!(
    isOwnerOrAdmin ||
    (profile as any)?.permissions?.includes?.('financeiro:manage_budget')
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Financeiro"
        description="Gestão de orçamentos, pagamentos e cobranças"
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <FinanceDashboard
          metrics={{
            budgetConversion: null,
            collectionRecovery: null,
          }}
          charges={[]}
          canManageBudget={canManageBudget}
        />
      </div>
    </div>
  );
}
