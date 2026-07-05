'use client';

import { useState } from 'react';

interface GatewayDisplay {
  id: string;
  provider: string;
  isDefault: boolean;
  isEnabled: boolean;
  maskedLabel: string | null;
}

/**
 * Gateway config tab — manages payment gateway credentials and routing.
 * Credentials are always masked when displayed.
 */
export function GatewayConfigTab() {
  const [gateways] = useState<GatewayDisplay[]>([]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure os gateways de pagamento e as regras de roteamento.
      </p>

      {gateways.length === 0 && (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Nenhum gateway configurado. Adicione um gateway para começar a receber cobranças.
        </div>
      )}

      {gateways.length > 0 && (
        <div className="space-y-2">
          {gateways.map(gw => (
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
