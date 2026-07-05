/**
 * Financeiro — repository helpers.
 *
 * Pure functions for scoping and insert building consumed by
 * financeiro actions and services.  No DB dependency required.
 *
 * Exports:
 *   assertSingleRoutingScope – enforces exactly one scope target
 *   buildChargeInsert       – builds a minimal payment_charges insert row
 */

export interface RoutingScope {
  campaignId?: string | null;
  patientId?: string | null;
  leadId?: string | null;
}

/**
 * Assert that a gateway routing rule targets exactly one scope.
 * Throws when zero or more than one scope ids are provided.
 */
export function assertSingleRoutingScope(rule: RoutingScope): void {
  const count = [rule.campaignId, rule.patientId, rule.leadId].filter(Boolean).length;
  if (count !== 1) {
    throw new Error('gateway_routing_rule_scope_conflict');
  }
}

export interface ChargeInsertInput {
  clinicId: string;
  budgetId: string;
  gatewayId: string;
  amount: number;
  dueDate: string;
}

export interface ChargeInsertRow {
  clinicId: string;
  budgetId: string;
  gatewayId: string;
  amount: string;
  dueDate: string;
  status: 'pending';
}

/**
 * Build a minimal payment_charges insert row from validated input.
 * Keeps tenant fields and defaults status to 'pending'.
 */
export function buildChargeInsert(input: ChargeInsertInput): ChargeInsertRow {
  return {
    clinicId: input.clinicId,
    budgetId: input.budgetId,
    gatewayId: input.gatewayId,
    amount: String(input.amount),
    dueDate: input.dueDate,
    status: 'pending',
  };
}
