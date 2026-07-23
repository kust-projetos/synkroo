'use client';

/**
 * Budget tab — lists budgets with status, totals, and actions.
 * Data fetched from /api/financeiro/budgets.
 */

export function BudgetTab() {
  // TODO: fetch from /api/financeiro/budgets when route is available
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Gerencie os orçamentos dos pacientes. Crie, envie, aceite ou rejeite orçamentos.
      </p>
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        Nenhum orçamento encontrado.
      </div>
    </div>
  );
}
