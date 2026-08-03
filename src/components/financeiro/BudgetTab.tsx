'use client';

import { useBudgets } from '@/lib/hooks/use-queries';

/**
 * Budget tab — lists budgets fetched via useBudgets (live hook).
 * Seleciona um orçamento para ver pagamentos em PaymentTab.
 */
export interface BudgetTabProps {
  selectedBudgetId?: string | null;
  onSelectBudget?: (id: string | null) => void;
}

export function BudgetTab({ selectedBudgetId, onSelectBudget }: BudgetTabProps = {}) {
  const { data: budgets, isLoading, error } = useBudgets();

  const rows: Array<{ id: string; patientName?: string; total?: number; status?: string }> =
    Array.isArray(budgets) ? budgets : (budgets as any)?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Carregando orçamentos...</p>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">Erro ao carregar orçamentos.</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Gerencie os orçamentos dos pacientes.
        </p>
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Nenhum orçamento encontrado.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Gerencie os orçamentos dos pacientes.
      </p>
      <div className="divide-y rounded-lg border">
        {rows.map((budget) => (
          <button
            key={budget.id}
            onClick={() => onSelectBudget?.(budget.id)}
            className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
              selectedBudgetId === budget.id ? 'bg-teal-50 dark:bg-teal-900/20' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{budget.patientName ?? 'Paciente'}</span>
              <span className="text-sm font-mono">
                {budget.total != null ? `R$ ${Number(budget.total).toFixed(2)}` : '-'}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 capitalize">
              {budget.status ?? '—'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}