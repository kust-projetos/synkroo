/**
 * Financeiro — Asaas gateway client stub.
 *
 * Implements PaymentGateway interface for Asaas API.
 * Full HTTP integration will be added in a later task.
 */

import type {
  PaymentGateway,
  CreateChargeInput,
  CreateChargeResult,
  GetChargeInput,
  GetChargeResult,
  CancelChargeInput,
  CancelChargeResult,
  WebhookInput,
  NormalizedGatewayEvent,
} from '../../contracts';
import { registerGatewayProvider } from '../../registry';

export const asaasClient: PaymentGateway = {
  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    // TODO: implement Asaas API call
    throw new Error('Asaas createCharge not yet implemented');
  },

  async getCharge(input: GetChargeInput): Promise<GetChargeResult> {
    // TODO: implement Asaas API call
    throw new Error('Asaas getCharge not yet implemented');
  },

  async cancelCharge(input: CancelChargeInput): Promise<CancelChargeResult> {
    // TODO: implement Asaas API call
    throw new Error('Asaas cancelCharge not yet implemented');
  },

  async handleWebhook(input: WebhookInput): Promise<NormalizedGatewayEvent> {
    // TODO: implement Asaas webhook processing
    throw new Error('Asaas handleWebhook not yet implemented');
  },
};

// Self-register at import time
registerGatewayProvider('asaas', asaasClient);
