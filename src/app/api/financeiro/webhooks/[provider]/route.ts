/**
 * POST /api/financeiro/webhooks/[provider]
 *
 * Provider webhook endpoint.
 * Does NOT use withModuleRoute — webhooks must always be reachable
 * to reconcile existing charges even when the module is disabled.
 *
 * Validates provider token against stored gateway config, then
 * processes the event idempotently via processAsaasWebhook.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processAsaasWebhook } from '@/modules/financeiro/gateways/providers/asaas/webhook';
import { listGateways } from '@/modules/financeiro/repositories/financeiro-repository';
import { decrypt } from '@/modules/financeiro/lib/crypto';
import { getPaymentGateway } from '@/modules/financeiro/repositories/financeiro-repository';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (provider !== 'asaas') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }

  // Read clinicId from URL param or header
  const clinicId = request.nextUrl.searchParams.get('clinicId') ||
    request.headers.get('x-clinic-id') || '';

  if (!clinicId) {
    return NextResponse.json({ error: 'clinicId query parameter or x-clinic-id header required' }, { status: 400 });
  }

  // Validate webhook token against stored gateway config
  const token = request.headers.get('x-asaas-token');
  if (!token) {
    return NextResponse.json({ error: 'Missing x-asaas-token header' }, { status: 401 });
  }

  // Find the Asaas gateway for this clinic and validate the token
  const gateways = await listGateways(clinicId);
  const asaasGw = gateways.find(g => g.provider === 'asaas' && g.isEnabled);

  if (!asaasGw) {
    return NextResponse.json({ error: 'No Asaas gateway configured for clinic' }, { status: 404 });
  }

  // Decrypt stored API key and compare with incoming token
  const full = await getPaymentGateway(asaasGw.id);
  let isValidToken = false;

  if (full?.encryptedConfig) {
    try {
      const enc = full.encryptedConfig as { iv: string; data: string; tag: string };
      if (enc.iv && enc.data && enc.tag) {
        const storedKey = decrypt(enc);
        isValidToken = storedKey === token;
      }
    } catch {
      // If decryption fails, token validation fails
    }
  }

  if (!isValidToken) {
    return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Process the webhook (idempotent via gateway_events table)
  const result = await processAsaasWebhook({
    clinicId,
    headers: request.headers,
    body,
  });

  if (result.duplicate) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  return NextResponse.json({ received: true, settled: result.settled });
}
