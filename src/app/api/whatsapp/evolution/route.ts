import { NextRequest, NextResponse } from 'next/server';
import { processEvolutionMessage } from '@/modules/atendimento/services/webhook-processor-service';
import { resolveChannelInstallation } from '@/modules/atendimento/integrations/resolve-channel-installation';
export const dynamic = 'force-dynamic';



function normalizeEvolutionGoMessage(body: Record<string, unknown>): Record<string, unknown> {
  const raw = (body.data || {}) as Record<string, unknown>;
  const info = (raw.Info || raw.info || {}) as Record<string, unknown>;
  const message = (raw.Message || raw.message || {}) as Record<string, unknown>;

  return {
    key: {
      id: info.ID ?? info.id,
      remoteJid: info.Chat ?? info.chat,
      remoteJidAlt: info.SenderAlt ?? info.senderAlt,
      fromMe: info.IsFromMe ?? info.isFromMe ?? false,
    },
    message: {
      conversation: message.Conversation ?? message.conversation,
      extendedTextMessage: message.ExtendedTextMessage ?? message.extendedTextMessage,
      imageMessage: message.ImageMessage ?? message.imageMessage,
      audioMessage: message.AudioMessage ?? message.audioMessage,
      documentMessage: message.DocumentMessage ?? message.documentMessage,
      buttonsResponseMessage: message.ButtonsResponseMessage ?? message.buttonsResponseMessage,
    },
  };
}

async function handlePOST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const rawInstance = body?.instanceName ?? body?.instance;
  const installationId = typeof rawInstance === 'string' ? rawInstance : '';
  const providedSecret = request.headers.get('X-Webhook-Secret') || request.nextUrl.searchParams.get('token') || '';
  const installation = await resolveChannelInstallation({
    installationId,
    providedSecret,
    provider: 'evolution',
  });
  if (!installation) {
    return NextResponse.json({ error: 'Invalid Evolution installation' }, { status: 403 });
  }
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const event = body.event;
  const isEvolutionGoMessage = event === 'Message' || event === 'SendMessage';
  const data = isEvolutionGoMessage
    ? normalizeEvolutionGoMessage(body)
    : body.data as Record<string, unknown> | undefined;

  const normalizedKey = data?.key as Record<string, unknown> | undefined;
  if (!data || (event !== 'messages.upsert' && !isEvolutionGoMessage) || !normalizedKey?.remoteJid) {
    return NextResponse.json({ status: 'ignored', event });
  }


  const instanceName = installation.installationId;
  const results = await processEvolutionMessage(data, instanceName);
  return NextResponse.json({
    success: true,
    processed: results.length > 0,
    results,
  });
}

export const POST = handlePOST;
