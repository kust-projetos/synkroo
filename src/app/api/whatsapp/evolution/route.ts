import { NextRequest, NextResponse } from 'next/server';
import { processEvolutionMessage } from '@/modules/atendimento/services/webhook-processor-service';

// Dedup cache
const processedIds = new Map<string, number>();
const DEDUP_TTL = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
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
