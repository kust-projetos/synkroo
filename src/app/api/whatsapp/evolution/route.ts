import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processEvolutionMessage } from '@/modules/atendimento/services/webhook-processor-service';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

/**
 * Verify Evolution API webhook secret via timing-safe comparison.
 * Header: X-Webhook-Secret.
 * Dev fallback: if WEBHOOK_SECRET is not set and NODE_ENV is not 'production',
 * requests are allowed through.
 */
function verifyEvolutionSecret(request: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const provided = request.headers.get('X-Webhook-Secret') || '';
  return provided.length === secret.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

// Dedup cache
const processedIds = new Map<string, number>();
const DEDUP_TTL = 5 * 60 * 1000;

async function handlePOST(request: NextRequest) {
  if (!verifyEvolutionSecret(request)) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });
  }

  const body = await request.json();
  const { event, instance, data } = body;

  if (event !== 'messages.upsert' || !data?.key?.remoteJid) {
    return NextResponse.json({ status: 'ignored', event });
  }

  const key = data.key;
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

  const results = await processEvolutionMessage(data, instance || 'synkroo');
  return NextResponse.json({
    success: true, processed: results.length > 0, results,
    ai_enabled: false, reason: 'legacy_agent_removed', todo: 'TODO(W5.3): reconnect to new agent',
  });
}

export const POST = withModuleRoute('atendimento', moduleManifest)(handlePOST);
