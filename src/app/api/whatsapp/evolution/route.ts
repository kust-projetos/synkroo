import { NextRequest, NextResponse } from 'next/server';
import { resolveChannelInstallation } from '@/modules/atendimento/integrations/resolve-channel-installation';
import { runAtendimentoSystemAction } from '@/modules/atendimento/ui/route-adapter';
import { receberMensagem } from '@/modules/atendimento/actions/receber-mensagem';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
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

function extractPhone(key: Record<string, unknown>): string | null {
  const remoteJid = typeof key.remoteJid === 'string' ? key.remoteJid : '';
  const remoteJidAlt = typeof key.remoteJidAlt === 'string' ? key.remoteJidAlt : '';
  const value = remoteJid.endsWith('@lid') && remoteJidAlt ? remoteJidAlt : remoteJid;
  const phone = value.split('@')[0];
  return phone || null;
}

function extractContent(data: Record<string, unknown>): { content: string; messageType: 'text' | 'image' | 'audio' | 'document' } {
  const message = data.message as Record<string, unknown> | undefined;
  if (!message) return { content: '', messageType: 'text' };
  const extended = message.extendedTextMessage as Record<string, unknown> | undefined;
  const image = message.imageMessage as Record<string, unknown> | undefined;
  const document = message.documentMessage as Record<string, unknown> | undefined;
  const button = message.buttonsResponseMessage as Record<string, unknown> | undefined;
  if (typeof message.conversation === 'string') return { content: message.conversation, messageType: 'text' };
  if (typeof extended?.text === 'string') return { content: extended.text, messageType: 'text' };
  if (image) return { content: typeof image.caption === 'string' ? image.caption : '[Image]', messageType: 'image' };
  if (message.audioMessage) return { content: '[Audio]', messageType: 'audio' };
  if (document) return { content: typeof document.fileName === 'string' ? document.fileName : '[Document]', messageType: 'document' };
  if (typeof button?.selectedDisplayText === 'string') return { content: button.selectedDisplayText, messageType: 'text' };
  return { content: '', messageType: 'text' };
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
  if (event !== 'messages.upsert' && !isEvolutionGoMessage) {
    return NextResponse.json({ status: 'ignored', event });
  }
  if (!data || !normalizedKey?.remoteJid) {
    return NextResponse.json({ error: 'Invalid Evolution message payload' }, { status: 400 });
  }
  if (typeof normalizedKey.id !== 'string' || normalizedKey.id.trim() === '') {
    return NextResponse.json({ error: 'Missing provider event ID' }, { status: 400 });
  }

  if (normalizedKey.fromMe === true) {
    return NextResponse.json({ success: true, processed: false, reason: 'outbound_callback' });
  }

  const phone = extractPhone(normalizedKey);
  const { content, messageType } = extractContent(data);
  if (!phone || phone.length < 10 || !content) {
    return NextResponse.json({ error: 'Invalid Evolution message payload' }, { status: 400 });
  }

  return runAtendimentoSystemAction(receberMensagem, {
    externalConversationId: phone,
    externalProvider: 'evolution',
    externalMessageId: normalizedKey.id,
    message: content,
    channel: 'whatsapp',
    messageType,
     metadata: {
       instance: installation.installationId,
       whatsapp_message_id: normalizedKey.id,
     },
  }, installation.clinicId, { okStatus: 200 });
}

export const POST = withModuleRoute('atendimento')(handlePOST);
