'use client';

import { useState } from 'react';
import { BudgetTab } from './BudgetTab';
import { PaymentTab } from './PaymentTab';
import { CollectionTab } from './CollectionTab';
import { GatewayConfigTab } from './GatewayConfigTab';

export interface DashboardMetrics {
  overdueCount: number;
  totalOverdue: number;
  overdueStages: { light: number; firm: number; internal: number };
}

export interface FinanceDashboardProps {
  metrics: DashboardMetrics;
  canManageBudget?: boolean;
}

type TabId = 'budgets' | 'payments' | 'collections' | 'config';

export function FinanceDashboard({ metrics, canManageBudget = false }: FinanceDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('budgets');
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'budgets', label: 'Orçamentos' },
    { id: 'payments', label: 'Parcelas / Pagamentos' },
    { id: 'collections', label: 'Cobranças' },
    { id: 'config', label: 'Config' },
  ];

  const handleSelectBudget = (id: string | null) => {
    setSelectedBudgetId(id);
    if (id) setActiveTab('payments');
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Dashboard metrics — overdue summary from /api/financeiro/dashboard */}
      <div data-testid="finance-kpis" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Cobranças Vencidas</p>
          <p className="text-2xl font-bold">{metrics.overdueCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total em Atraso</p>
          <p className="text-2xl font-bold">
            R$ {metrics.totalOverdue.toFixed(2).replace('.', ',')}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 min-w-0">
          <p className="text-sm text-muted-foreground">Estágios</p>
          <p className="text-xs mt-1">
            <span className="inline-block w-16">Leve:</span> {metrics.overdueStages.light}
            <span className="inline-block w-16 ml-3">Firme:</span> {metrics.overdueStages.firm}
            <span className="inline-block w-16 ml-3">Interna:</span> {metrics.overdueStages.internal}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4 overflow-x-auto" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === 'budgets' && (
          <BudgetTab
            selectedBudgetId={selectedBudgetId}
            onSelectBudget={handleSelectBudget}
          />
        )}
        {activeTab === 'payments' && (
          <PaymentTab selectedBudgetId={selectedBudgetId} />
        )}
        {activeTab === 'collections' && (
          <CollectionTab canManageBudget={canManageBudget} />
        )}
        {activeTab === 'config' && <GatewayConfigTab />}
      </div>
    </div>
  );
}