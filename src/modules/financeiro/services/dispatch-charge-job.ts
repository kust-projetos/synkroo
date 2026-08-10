import { getGatewayProvider } from '../gateways/registry';
import { getPaymentGateway, updatePaymentCharge } from '../repositories/financeiro-repository';
import { dispatchNextOutbox } from '@/lib/outbox/dispatch-outbox';
import type { OutboxJob } from '@/lib/outbox/outbox-repository';
import type { GatewayProvider } from '../gateways/contracts';

export async function dispatchChargeJob(job: OutboxJob): Promise<void> {
  const payload = job.payload as Record<string, unknown>;
  const chargeId = String(payload.chargeId ?? '');
  const clinicId = String(payload.clinicId ?? job.clinicId);
  const gatewayId = String(payload.gatewayId ?? '');
  const gateway = await getPaymentGateway(gatewayId);
  if (!gateway) throw new Error('PAYMENT_GATEWAY_NOT_FOUND');
  const provider = getGatewayProvider(gateway.provider as GatewayProvider);
  if (!provider) throw new Error('PAYMENT_GATEWAY_PROVIDER_NOT_REGISTERED');

  if (job.operation === 'financeiro.charge.create') {
    const result = await provider.createCharge({
      clinicId,
      amount: Number(payload.amount),
      dueDate: String(payload.dueDate),
      customerName: 'Cliente',
    });
    const updated = await updatePaymentCharge(chargeId, {
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
      await provider.cancelCharge({ externalChargeId: String(payload.externalChargeId), clinicId });
    }
    await updatePaymentCharge(chargeId, { status: 'cancelled' }, ['cancellation_pending']);
    return;
  }

  throw new Error(`UNKNOWN_OUTBOX_OPERATION:${job.operation}`);
}

const CHARGE_OPERATIONS = ['financeiro.charge.create', 'financeiro.charge.cancel'] as const;

export function dispatchNextChargeJob() {
  return dispatchNextOutbox(dispatchChargeJob, { operations: CHARGE_OPERATIONS });
}
