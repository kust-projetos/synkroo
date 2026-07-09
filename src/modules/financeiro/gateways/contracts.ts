/**
 * Financeiro — gateway contracts.
 *
 * Multi-provider payment gateway abstraction.
 * Each provider implements the PaymentGateway interface.
 */

export type GatewayProvider = 'asaas' | 'mercado_pago' | 'pagarme' | 'efi';

// ─── Shared input types ────────────────────────────────────────────────────────

export interface CreateChargeInput {
  clinicId: string;
  amount: number;
  dueDate: string;
  customerName: string;
  customerCpfCnpj?: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
}

export interface GetChargeInput {
  externalChargeId: string;
  clinicId: string;
}

export interface CancelChargeInput {
  externalChargeId: string;
  clinicId: string;
}

export interface WebhookInput {
  clinicId: string;
  headers: Headers;
  body: unknown;
}

// ─── Shared result types ───────────────────────────────────────────────────────

export interface CreateChargeResult {
  externalChargeId: string;
  paymentUrl: string | null;
  pixQrCode: string | null;
  status: 'pending' | 'paid' | 'cancelled' | 'overdue';
}

export type GetChargeResult = CreateChargeResult;

export interface CancelChargeResult {
  cancelled: boolean;
}

export interface NormalizedGatewayEvent {
  provider: GatewayProvider;
  externalEventId: string;
  externalChargeId: string;
  status: 'pending' | 'paid' | 'cancelled' | 'overdue';
  paidAt?: string;
  raw: unknown;
}

// ─── Provider interface ────────────────────────────────────────────────────────

export interface PaymentGateway {
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  getCharge(input: GetChargeInput): Promise<GetChargeResult>;
  cancelCharge(input: CancelChargeInput): Promise<CancelChargeResult>;
  handleWebhook(input: WebhookInput): Promise<NormalizedGatewayEvent>;
}
