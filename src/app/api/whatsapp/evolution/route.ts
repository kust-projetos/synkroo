import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processEvolutionMessage } from '@/modules/atendimento/services/webhook-processor-service';
export const dynamic = 'force-dynamic';

/**
 * Verify Evolution API webhook secret via timing-safe comparison.
 * Header: X-Webhook-Secret. Evolution Go has no custom-header support, so
 * its dedicated EVOLUTION_WEBHOOK_SECRET may also arrive as a query token.
 * Dev fallback: if WEBHOOK_SECRET is not set and NODE_ENV is not 'production',
 * requests are allowed through.
 */
function verifyEvolutionSecret(request: NextRequest): boolean {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const provided = request.headers.get('X-Webhook-Secret') ||
    request.nextUrl.searchParams.get('token') || '';
  return provided.length === secret.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

// Dedup cache
const processedIds = new Map<string, number>();
const DEDUP_TTL = 5 * 60 * 1000;

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
  if (!verifyEvolutionSecret(request)) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });
  }

  const body = await request.json() as Record<string, unknown>;
  const event = body.event;
  const instance = body.instanceName || body.instance || 'synkroo';
  const isEvolutionGoMessage = event === 'Message' || event === 'SendMessage';
  const data = isEvolutionGoMessage
    ? normalizeEvolutionGoMessage(body)
    : body.data as Record<string, unknown> | undefined;

  const normalizedKey = data?.key as Record<string, unknown> | undefined;
  if (!data || (event !== 'messages.upsert' && !isEvolutionGoMessage) || !normalizedKey?.remoteJid) {
    return NextResponse.json({ status: 'ignored', event });
  }

  const key = normalizedKey;
  const messageId = key.id as string;
  if (messageId) {
    const now = Date.now();
    if (processedIds.has(messageId) && (now - processedIds.get(messageId)!) < DEDUP_TTL) {
      return NextResponse.json({ status: 'ignored', reason: 'Duplicate' });
    }
    processedIds.set(messageId, now);
    if (processedIds.size > 100) {
      for (const [id, ts] of processedIds) { if (now - ts > DEDUP_TTL) processedIds.delete(id); }
    }
  }

  const instanceName = typeof instance === 'string' ? instance : 'synkroo';
  const results = await processEvolutionMessage(data, instanceName);
  return NextResponse.json({
    success: true, processed: results.length > 0, results,
    ai_enabled: false, reason: 'legacy_agent_removed', todo: 'TODO(W5.3): reconnect to new agent',
  });
}

export const POST = handlePOST;
