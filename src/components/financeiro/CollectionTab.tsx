'use client';

import type { DashboardCharge } from './FinanceDashboard';

export interface CollectionTabProps {
  charges: DashboardCharge[];
  canManageBudget: boolean;
}

/**
 * Collections tab — shows overdue charges queue and manual reminder actions.
 * Cancel charge button appears only for open charges and users with permission.
 */
export function CollectionTab({ charges, canManageBudget }: CollectionTabProps) {
  const openCharges = charges.filter(c => c.status === 'pending' || c.status === 'overdue');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cobranças atrasadas e pendentes.
      </p>

      {openCharges.length === 0 && (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Nenhuma cobrança pendente ou atrasada.
        </div>
      )}

      {openCharges.length > 0 && (
        <div className="space-y-2">
          {openCharges.map(charge => (
            <div key={charge.id} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Cobrança {charge.id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">
                  Status: {charge.status}
                  {charge.dueDate && ` | Vencimento: ${charge.dueDate}`}
                </p>
              </div>
              <div className="flex gap-2">
                {canManageBudget && (
                  <button
                    className="rounded bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                    onClick={() => {
                      // TODO: call cancelarCobranca action
                    }}
                  >
                    Cancelar cobrança
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
