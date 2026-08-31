/**
 * Deprecated compatibility re-exports.
 * New code imports schemas from their owning bounded context.
 */
export {
  appointmentStatusLog,
  treatmentPlans,
  treatmentPlanItems,
} from '@/modules/operacional/schema/treatments';

export {
  budgets,
  budgetItems,
  budgetInstallments,
  payments,
  paymentGateways,
  paymentCharges,
  gatewayRoutingRules,
  gatewayEvents,
  collectionAttempts,
} from '@/modules/financeiro/schema';
