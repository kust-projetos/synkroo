import { getGatewayProvider } from '../gateways/registry';
import {
  getPaymentGatewayForClinic,
  getPaymentChargeForClinic,
  getBudgetForClinic,
  updatePaymentChargeForClinic,
} from '../repositories/financeiro-repository';
import { dispatchNextOutbox } from '@/lib/outbox/dispatch-outbox';
import type { OutboxJob } from '@/lib/outbox/outbox-repository';
import type { GatewayProvider } from '../gateways/contracts';

export async function dispatchChargeJob(job: OutboxJob): Promise<void> {
  const clinicId = job.clinicId;
  if (!clinicId) throw new Error('PAYMENT_CHARGE_NOT_FOUND');
  const payload = job.payload as Record<string, unknown>;
  const chargeId = String(payload.chargeId ?? '');
  const gatewayId = String(payload.gatewayId ?? '');
  if (!chargeId || !gatewayId) throw new Error('PAYMENT_CHARGE_NOT_FOUND');

  // Gateway / charge / budget devem pertencer à mesma clínica do job antes de qualquer chamada externa.
  // Falha fechada: não revela se vítima existe, não chama provider, não muta outra clínica.
  const charge = await getPaymentChargeForClinic(chargeId, clinicId);
  if (!charge) throw new Error('PAYMENT_CHARGE_NOT_FOUND');
  const gateway = await getPaymentGatewayForClinic(gatewayId, clinicId);
  if (!gateway) throw new Error('PAYMENT_GATEWAY_NOT_FOUND');
  if (charge.gatewayId !== gateway.id) throw new Error('PAYMENT_GATEWAY_NOT_FOUND');
  const budget = await getBudgetForClinic(charge.budgetId, clinicId);
  if (!budget) throw new Error('PAYMENT_CHARGE_NOT_FOUND');

  const provider = getGatewayProvider(gateway.provider as GatewayProvider);
  if (!provider) throw new Error('PAYMENT_GATEWAY_PROVIDER_NOT_REGISTERED');

  if (job.operation === 'financeiro.charge.create') {
    const result = await provider.createCharge({
      clinicId,
      amount: Number(payload.amount),
      dueDate: String(payload.dueDate),
      customerName: 'Cliente',
      idempotencyKey: job.businessKey,
    });
    const updated = await updatePaymentChargeForClinic(chargeId, clinicId, {
      externalChargeId: result.externalChargeId,
      paymentUrl: result.paymentUrl,
      pixQrCode: result.pixQrCode,
      status: result.status,
    }, ['pending']);
    if (!updated) return;
    return;
  }

  if (job.operation === 'financeiro.charge.cancel') {
    if (payload.externalChargeId) {
      await provider.cancelCharge({
        externalChargeId: String(payload.externalChargeId),
        clinicId,
        idempotencyKey: job.businessKey,
      });
    }
    await updatePaymentChargeForClinic(chargeId, clinicId, { status: 'cancelled' }, ['cancellation_pending']);
    return;
  }

  throw new Error(`UNKNOWN_OUTBOX_OPERATION:${job.operation}`);
}

const CHARGE_OPERATIONS = ['financeiro.charge.create', 'financeiro.charge.cancel'] as const;

export function dispatchNextChargeJob() {
  return dispatchNextOutbox(dispatchChargeJob, { operations: CHARGE_OPERATIONS });
}
