import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { runAtendimentoSystemAction } from '@/modules/atendimento/ui/route-adapter';
import { receberMensagem } from '@/modules/atendimento/actions/receber-mensagem';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

function verifyWebhookSecret(request: NextRequest): boolean {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }
  const provided = request.headers.get('X-Webhook-Secret') || '';
  if (provided.length !== webhookSecret.length ||
      !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(webhookSecret))) {
    return false;
  }
  return true;
}

async function handlePOST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, { ...rateLimitPresets.webhook, keyPrefix: 'msg-inbound' });
  if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  if (!verifyWebhookSecret(request)) return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });

  const body = await request.json();
  const { clinicId, from, message, channel, metadata } = body as {
    clinicId: string; from: string; message: string; channel?: string; metadata?: Record<string, unknown>;
  };
  if (!clinicId || !from || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  return runAtendimentoSystemAction(receberMensagem, {
    clinicId, from, message, channel: channel ?? 'web', metadata,
  }, clinicId, { okStatus: 201 });
}

export const POST = withModuleRoute('atendimento', moduleManifest)(handlePOST);
