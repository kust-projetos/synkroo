'use client';

/**
 * Payment tab — lists installments, manual payments, and generated charges.
 * Shows cancel button only for open charges when user has permission.
 */

export function PaymentTab() {
  // TODO: fetch installments + payments from Financeiro API
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
