import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { receberMensagem } from '@/modules/atendimento/actions/receber-mensagem';
import { runAtendimentoSystemActionResult } from '@/modules/atendimento/ui/route-adapter';
import { resolveInstagramInstallation } from '@/modules/atendimento/repositories/conversations-repository';
import { withModuleRoute } from '@/core/modules/gates';

function verifySignature(body: string, signature: string | null): boolean {
  const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.WHATSAPP_APP_SECRET;
  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken || !appSecret) {
    if (process.env.NODE_ENV !== 'development') return false;
    return true;
  }
  if (!signature) return false;
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(body).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
}

async function handleGET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const mode = sp.get('hub.mode');
  const token = sp.get('hub.verify_token');
  const challenge = sp.get('hub.challenge');
  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

async function handlePOST(request: NextRequest) {
  // Verify HMAC before rate limit — invalid payload must not consume legitimate quota (T1 b pattern)
  const signature = request.headers.get('x-hub-signature-256');
  const body = await request.text();
  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, { ...rateLimitPresets.webhook, keyPrefix: 'ig-webhook' });
  if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (payload.object !== 'instagram') {
    return NextResponse.json({ status: 'ignored' });
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  let processed = 0;
  let deduped = 0;

  for (const entry of entries as Array<Record<string, unknown>>) {
    // Instagram account ID is entry.id or entry.messaging[0].recipient.id
    const accountId = typeof entry.id === 'string' ? entry.id : undefined;
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
    // Some payloads use changes/value pattern (like whatsapp) — handle both
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    const messagingFromChanges = changes.flatMap((c) => {
      const v = (c as any).value;
      if (v?.messaging) return v.messaging;
      return [];
    });
    const allMessaging = messaging.length > 0 ? messaging : messagingFromChanges;

    if (allMessaging.length === 0) continue;

    // Resolve installation once per entry (server-side, never from body clinicId)
    // Prefer accountId from entry.id, fallback to first messaging recipient.id
    const recipientId = (allMessaging[0] as any)?.recipient?.id as string | undefined;
    const resolvedAccountId = accountId || recipientId || '';
    const installation = await resolveInstagramInstallation(resolvedAccountId);
    if (!installation) {
      return NextResponse.json({ error: 'Invalid Instagram installation' }, { status: 403 });
    }

    for (const event of allMessaging as Array<Record<string, unknown>>) {
      const sender = event.sender as Record<string, unknown> | undefined;
      const recipient = event.recipient as Record<string, unknown> | undefined;
      const message = event.message as Record<string, unknown> | undefined;
      const timestamp = event.timestamp as string | number | undefined;

      const from = typeof sender?.id === 'string' ? sender.id as string : '';
      const mid = typeof message?.mid === 'string' ? message.mid as string : typeof (message as any)?.id === 'string' ? (message as any).id as string : '';

      // Basic validation
      if (!from || !mid) {
        return NextResponse.json({ error: 'Invalid Instagram message payload' }, { status: 400 });
      }

      // Extract content
      let content = '';
      let messageType: 'text' | 'image' | 'audio' | 'document' = 'text';
      if (typeof message?.text === 'string' && (message.text as string)) {
        content = message.text as string;
      } else if (message?.attachments) {
        const att = (message.attachments as Array<Record<string, unknown>>)[0];
        if (att?.type === 'image') {
          content = typeof att.caption === 'string' && (att.caption as string) ? (att.caption as string) : '[Image]';
          messageType = 'image';
        } else if (att?.type === 'audio') {
          content = '[Audio]';
          messageType = 'audio';
        } else {
          content = '[Attachment]';
          messageType = 'document';
        }
      } else {
        // Check for is_echo or other non-message events — ignore
        continue;
      }

      // Timestamp freshness check (24h) — skip stale
      if (timestamp) {
        const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
        if (!Number.isNaN(ts) && Date.now() - ts > 24 * 60 * 60 * 1000) continue;
      }

      const result = await runAtendimentoSystemActionResult(
        receberMensagem,
        {
          externalConversationId: from,
          externalProvider: 'instagram',
          externalMessageId: mid,
          message: content,
          channel: 'instagram',
          messageType,
          metadata: {
            instagramAccountId: resolvedAccountId,
            recipientId: typeof recipient?.id === 'string' ? recipient.id : undefined,
            timestamp,
          },
        },
        installation.clinicId,
      );

      if (!result.ok) {
        const status = result.error.code === 'invalid_input' ? 422 : 500;
        return NextResponse.json({ error: result.error.message }, { status });
      }
      if (result.data && typeof result.data === 'object' && 'deduped' in result.data && (result.data as any).deduped) deduped++;
      else processed++;
    }
  }

  return NextResponse.json({ success: true, processed, deduped });
}

export const GET = withModuleRoute('atendimento')(handleGET);
export const POST = withModuleRoute('atendimento')(handlePOST);
