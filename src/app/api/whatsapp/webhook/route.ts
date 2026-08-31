import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { receberMensagem } from '@/modules/atendimento/actions/receber-mensagem';
import { runAtendimentoSystemActionResult } from '@/modules/atendimento/ui/route-adapter';
import { resolveMetaInstallation } from '@/modules/atendimento/integrations/resolve-channel-installation';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

async function handleGET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const mode = sp.get('hub.mode');
  const token = sp.get('hub.verify_token');
  const challenge = sp.get('hub.challenge');
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return new NextResponse(challenge, { status: 200 });
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

async function handlePOST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, { ...rateLimitPresets.webhook, keyPrefix: 'wa-webhook' });
  if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const signature = request.headers.get('x-hub-signature-256');
  const body = await request.text();
  if (!verifySignature(body, signature)) return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (payload.object !== 'whatsapp_business_account') return NextResponse.json({ status: 'ignored' });

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  let processed = 0;
  let deduped = 0;
  for (const entry of entries as Array<Record<string, unknown>>) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes as Array<Record<string, unknown>>) {
      const value = change.value as Record<string, unknown> | undefined;
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      if (messages.length === 0) continue;
      const metadata = value?.metadata as Record<string, unknown> | undefined;
      const phoneNumberId = typeof metadata?.phone_number_id === 'string' ? metadata.phone_number_id : '';
      const installation = await resolveMetaInstallation(phoneNumberId);
      if (!installation) return NextResponse.json({ error: 'Invalid WhatsApp installation' }, { status: 403 });

      for (const message of messages as Array<Record<string, unknown>>) {
        const from = typeof message.from === 'string' ? message.from : '';
        const externalMessageId = typeof message.id === 'string' ? message.id : '';
        const parsed = parseMetaMessage(message);
        if (!from || !externalMessageId || !parsed) {
          return NextResponse.json({ error: 'Invalid WhatsApp message payload' }, { status: 400 });
        }
        const result = await runAtendimentoSystemActionResult(receberMensagem, {
          externalConversationId: from,
          externalProvider: 'meta',
          externalMessageId,
          message: parsed.content,
          channel: 'whatsapp',
          messageType: parsed.messageType,
          metadata: { phoneNumberId },
        }, installation.clinicId);
        if (!result.ok) {
          const status = result.error.code === 'invalid_input' ? 422 : 500;
          return NextResponse.json({ error: result.error.message }, { status });
        }
        if (result.data && typeof result.data === 'object' && 'deduped' in result.data && result.data.deduped) deduped++;
        else processed++;
      }
    }
  }

  return NextResponse.json({
    success: true, processed, deduped,
  });
}

function parseMetaMessage(message: Record<string, unknown>): {
  content: string;
  messageType: 'text' | 'image' | 'audio' | 'document';
} | null {
  const type = typeof message.type === 'string' ? message.type : '';
  const value = message[type] as Record<string, unknown> | undefined;
  if (!value) return null;
  if (type === 'text' && typeof value.body === 'string' && value.body) {
    return { content: value.body, messageType: 'text' };
  }
  if (type === 'image') return { content: typeof value.caption === 'string' && value.caption ? value.caption : '[Image]', messageType: 'image' };
  if (type === 'audio') return { content: '[Audio]', messageType: 'audio' };
  if (type === 'document') return { content: typeof value.caption === 'string' && value.caption ? value.caption : '[Document]', messageType: 'document' };
  return null;
}

export const GET = withModuleRoute('atendimento')(handleGET);
export const POST = withModuleRoute('atendimento')(handlePOST);

function verifySignature(body: string, signature: string | null): boolean {
  if (!VERIFY_TOKEN || !APP_SECRET) {
    if (process.env.NODE_ENV !== 'development') return false;
    return true;
  }
  if (!signature) return false;
  const expected = 'sha256=' + createHmac('sha256', APP_SECRET).update(body).digest('hex');
  return signature === expected;
}
