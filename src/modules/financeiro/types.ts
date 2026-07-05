/**
 * Financeiro — shared type definitions.
 */

import type { PaymentGateway } from './gateways/contracts';

/**
 * Resolved gateway strategy after routing evaluation.
 * Contains the winning provider and its implementation.
 */
export interface ResolvedGateway {
  gatewayId: string;
  provider: string;
  implementation: PaymentGateway;
}

/**
 * Period filter for dashboard queries.
 */
export interface PeriodFilter {
  from: Date;
  to: Date;
}
