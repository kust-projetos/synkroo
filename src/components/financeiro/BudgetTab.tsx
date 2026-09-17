'use client';

import { useBudgets, useUpdateBudgetStatus } from '@/lib/hooks/use-queries';
import { useToast } from '@/hooks/use-toast';

/**
 * Budget tab — lists budgets fetched via useBudgets (live hook).
 * Seleciona um orçamento para ver pagamentos em PaymentTab.
 * Ações de aceitar/recusar via useUpdateBudgetStatus (Etapa 13:
 * pending por linha + toast de sucesso/erro).
 */
export interface BudgetTabProps {
  selectedBudgetId?: string | null;
  onSelectBudget?: (id: string | null) => void;
  canManageBudget?: boolean;
}

/** Status terminais — sem ação disponível. */
const TERMINAL_STATUSES = new Set(['accepted', 'rejected', 'cancelled', 'archived']);

export function BudgetTab({ selectedBudgetId, onSelectBudget, canManageBudget = false }: BudgetTabProps = {}) {
  const { data: budgets, isLoading, error } = useBudgets();
  const updateStatus = useUpdateBudgetStatus();
  const { toast } = useToast();

  const rows: Array<{ id: string; patientName?: string; total?: number; status?: string }> =
    Array.isArray(budgets) ? budgets : (budgets as any)?.data ?? [];

  const pendingId = updateStatus.isPending ? updateStatus.variables?.id : undefined;

  function handleStatusChange(budgetId: string, status: 'accepted' | 'rejected') {
    updateStatus.mutate(
      { id: budgetId, status },
      {
        onSuccess: () => {
          toast({
            title: status === 'accepted' ? 'Orçamento aceito' : 'Orçamento recusado',
            description:
              status === 'accepted'
                ? 'O orçamento foi marcado como aceito.'
                : 'O orçamento foi marcado como recusado.',
          });
        },
        onError: (err) => {
          toast({
            title: 'Erro ao atualizar orçamento',
            description: err instanceof Error ? err.message : 'Não foi possível atualizar. Tente novamente.',
            variant: 'destructive',
          });
        },
      },
    );
  }

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
      <div className="divide-y rounded-lg border" aria-live="polite">
        {rows.map((budget) => {
          const isPending = pendingId === budget.id;
          const showActions = canManageBudget && !TERMINAL_STATUSES.has(budget.status ?? '');
          return (
            <div
              key={budget.id}
              className={`flex items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/50 ${
                selectedBudgetId === budget.id ? 'bg-teal-50 dark:bg-teal-900/20' : ''
              }`}
            >
              <button
                onClick={() => onSelectBudget?.(budget.id)}
                className="flex-1 text-left"
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
              {showActions && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(budget.id, 'accepted')}
                    disabled={isPending}
                    aria-busy={isPending}
                    className="rounded bg-teal-600/10 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-600/20 disabled:opacity-50 dark:text-teal-400"
                  >
                    {isPending ? 'Salvando...' : 'Aceitar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(budget.id, 'rejected')}
                    disabled={isPending}
                    aria-busy={isPending}
                    className="rounded bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                  >
                    {isPending ? 'Salvando...' : 'Recusar'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {updateStatus.isPending && (
        <p aria-live="polite" className="sr-only">Salvando orçamento...</p>
      )}
    </div>
  );
}
