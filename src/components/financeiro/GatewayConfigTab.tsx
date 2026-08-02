'use client';

import { useGateways } from '@/lib/hooks/use-queries';

interface GatewayDisplay {
  id: string;
  provider: string;
  isDefault: boolean;
  isEnabled: boolean;
  maskedLabel: string | null;
}

/**
 * Gateway config tab — carrega gateways via useGateways hook (Task 7).
 * Exibe loading/error/empty conforme o estado do hook.
 */
export function GatewayConfigTab() {
  const { data, isLoading, error } = useGateways();

  const gateways: GatewayDisplay[] = Array.isArray(data)
    ? (data as GatewayDisplay[])
    : (((data as any)?.data as GatewayDisplay[]) ?? []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure os gateways de pagamento e as regras de roteamento.
      </p>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-muted" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">Erro ao carregar gateways.</p>
        </div>
      )}

      {!isLoading && !error && gateways.length === 0 && (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Nenhum gateway configurado.
        </div>
      )}

      {!isLoading && !error && gateways.length > 0 && (
        <div className="space-y-2">
          {gateways.map((gw) => (
            <div key={gw.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium capitalize">{gw.provider}</p>
                  <p className="text-xs text-muted-foreground">
                    {gw.maskedLabel ?? 'Credenciais configuradas'}
                    {gw.isDefault && ' | Padrão'}
                    {!gw.isEnabled && ' | Desativado'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}