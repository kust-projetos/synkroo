'use client';

import { useState } from 'react';
import { BudgetTab } from './BudgetTab';
import { PaymentTab } from './PaymentTab';
import { CollectionTab } from './CollectionTab';
import { GatewayConfigTab } from './GatewayConfigTab';
import { renderRatio } from '@/modules/financeiro/services/dashboard-service';

export interface DashboardMetrics {
  budgetConversion: number | null;
  collectionRecovery: number | null;
}

export interface DashboardCharge {
  id: string;
  status: string;
  dueDate?: string;
  amount?: string;
}

export interface FinanceDashboardProps {
  metrics: DashboardMetrics;
  charges: DashboardCharge[];
  canManageBudget?: boolean;
}

type TabId = 'budgets' | 'payments' | 'collections' | 'config';

export function FinanceDashboard({ metrics, charges, canManageBudget = false }: FinanceDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('budgets');
  const openCharges = charges.filter(c => c.status === 'pending' || c.status === 'overdue');

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'budgets', label: 'Orçamentos' },
    { id: 'payments', label: 'Parcelas / Pagamentos' },
    { id: 'collections', label: 'Cobranças' },
    { id: 'config', label: 'Config' },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Dashboard metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Conversão de Orçamentos</p>
          <p className="text-2xl font-bold">{renderRatio(metrics.budgetConversion)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Recuperação de Cobranças</p>
          <p className="text-2xl font-bold">{renderRatio(metrics.collectionRecovery)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
        {activeTab === 'budgets' && <BudgetTab />}
        {activeTab === 'payments' && <PaymentTab />}
        {activeTab === 'collections' && (
          <CollectionTab
            charges={charges}
            canManageBudget={canManageBudget}
          />
        )}
        {activeTab === 'config' && <GatewayConfigTab />}
      </div>
    </div>
  );
}
