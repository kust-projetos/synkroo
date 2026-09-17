'use client';

import { useCancelCharge, useCollections } from '@/lib/hooks/use-queries';
import { useToast } from '@/hooks/use-toast';

interface Charge { id: string; status: string; dueDate?: string; amount?: string; }

export interface CollectionTabProps {
  canManageBudget?: boolean;
}

/**
 * Collections tab — carrega cobranças via useCollections hook (Task 7).
 * Exibe loading/error/empty/data states. Cancel charge via useCancelCharge
 * (Etapa 13: pending por linha + toast de sucesso/erro, sem reload de página).
 */
export function CollectionTab({ canManageBudget = false }: CollectionTabProps) {
  const { data, isLoading, error } = useCollections();
  const cancelCharge = useCancelCharge();
  const { toast } = useToast();

  const charges: Charge[] = (data as any)?.charges ?? [];
  const openCharges = charges.filter(c => c.status === 'pending' || c.status === 'overdue');
  const pendingId = cancelCharge.isPending ? cancelCharge.variables : undefined;

  function handleCancel(chargeId: string) {
    cancelCharge.mutate(chargeId, {
      onSuccess: () => {
        toast({
          title: 'Cobrança cancelada',
          description: 'A cobrança foi cancelada com sucesso.',
        });
      },
      onError: (err) => {
        toast({
          title: 'Erro ao cancelar cobrança',
          description: err instanceof Error ? err.message : 'Não foi possível cancelar. Tente novamente.',
          variant: 'destructive',
        });
      },
    });
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

      {openCharges.length === 0 && (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Nenhuma cobrança pendente ou atrasada.
        </div>
      )}

      {openCharges.length > 0 && (
        <div className="space-y-2" aria-live="polite">
          {openCharges.map(charge => {
            const isCancelling = pendingId === charge.id;
            return (
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
                      disabled={isCancelling}
                      aria-busy={isCancelling}
                    >
                      {isCancelling ? 'Cancelando...' : 'Cancelar cobrança'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cancelCharge.isPending && (
        <p aria-live="polite" className="sr-only">Cancelando cobrança...</p>
      )}
    </div>
  );
}
