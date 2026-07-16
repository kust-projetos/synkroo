'use client';

import { useState } from 'react';
import { useCollections } from '@/lib/hooks/use-queries';

interface Charge { id: string; status: string; dueDate?: string; amount?: string; }

export interface CollectionTabProps {
  canManageBudget?: boolean;
}

/**
 * Collections tab — carrega cobranças via useCollections hook (Task 7).
 * Exibe loading/error/empty/data states. Cancel charge button dispara
 * POST /api/financeiro/charges/[id]/cancel.
 */
export function CollectionTab({ canManageBudget = false }: CollectionTabProps) {
  const { data, isLoading, error } = useCollections();
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [cancelError, setCancelError] = useState<string | null>(null);

  const charges: Charge[] = (data as any)?.charges ?? [];
  const openCharges = charges.filter(c => c.status === 'pending' || c.status === 'overdue');

  async function handleCancel(chargeId: string) {
    setCancellingIds(prev => new Set(prev).add(chargeId));
    setCancelError(null);
    try {
      const res = await fetch(`/api/financeiro/charges/${chargeId}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Erro ao cancelar' }));
        setCancelError(body.error || 'Erro ao cancelar cobrança');
      }
      window.location.reload();
    } catch {
      setCancelError('Erro de conexão ao cancelar cobrança');
    } finally {
      setCancellingIds(prev => {
        const next = new Set(prev);
        next.delete(chargeId);
        return next;
      });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Carregando cobranças...</p>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">Erro ao carregar cobranças.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cobranças atrasadas e pendentes.
      </p>

      {cancelError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {cancelError}
        </div>
      )}

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
                {canManageBudget && (charge.status === 'pending' || charge.status === 'overdue') && (
                  <button
                    className="rounded bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                    onClick={() => handleCancel(charge.id)}
                    disabled={cancellingIds.has(charge.id)}
                  >
                    {cancellingIds.has(charge.id) ? 'Cancelando...' : 'Cancelar cobrança'}
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