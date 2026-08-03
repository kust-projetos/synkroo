'use client';

import { usePayments } from '@/lib/hooks/use-queries';

export interface PaymentTabProps {
  selectedBudgetId?: string | null;
}

/**
 * Payment tab — lists payments ONLY for the selected budget.
 * Se nenhum orçamento estiver selecionado, pede para selecionar.
 * Dados via usePayments hook (Task 7).
 */
export function PaymentTab({ selectedBudgetId }: PaymentTabProps = {}) {
  const { data: payments, isLoading, error } = usePayments(selectedBudgetId ?? null);

  if (!selectedBudgetId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Selecione um orçamento na aba Orçamentos para ver os pagamentos.
        </p>
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Nenhum orçamento selecionado.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Carregando pagamentos...</p>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">Erro ao carregar pagamentos.</p>
      </div>
    );
  }

  const rows: Array<{ id: string; amount?: number; status?: string; dueDate?: string }> =
    Array.isArray(payments) ? payments : (payments as any)?.data ?? [];

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Acompanhe parcelas, pagamentos e cobranças geradas.
        </p>
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Nenhum pagamento ou parcela encontrado.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pagamentos do orçamento selecionado.
      </p>
      <div className="divide-y rounded-lg border">
        {rows.map((payment) => (
          <div key={payment.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono">
                R$ {payment.amount != null ? Number(payment.amount).toFixed(2) : '-'}
              </span>
              <span className="text-xs capitalize">{payment.status ?? '—'}</span>
            </div>
            {payment.dueDate && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Vencimento: {new Date(payment.dueDate).toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}