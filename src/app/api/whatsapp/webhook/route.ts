import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { processMetaWebhookEntry } from '@/modules/atendimento/services/webhook-processor-service';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const mode = sp.get('hub.mode');
  const token = sp.get('hub.verify_token');
  const challenge = sp.get('hub.challenge');
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return new NextResponse(challenge, { status: 200 });
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, { ...rateLimitPresets.webhook, keyPrefix: 'wa-webhook' });
  if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const signature = request.headers.get('x-hub-signature-256');
  const body = await request.text();
  if (!verifySignature(body, signature)) return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });

  const payload = JSON.parse(body);
  if (payload.object !== 'whatsapp_business_account') return NextResponse.json({ status: 'ignored' });

  const entries = payload.entry || [];
  const allResults: Array<{ from: string; action: string }> = [];

  for (const entry of entries) {
    const results = await processMetaWebhookEntry(entry);
    allResults.push(...results);
  }

  return NextResponse.json({
    success: true, processed: allResults.length, messages: allResults,
    ai_enabled: false, reason: 'legacy_agent_removed', todo: 'TODO(W5.3): reconnect to new agent',
  });
}

function verifySignature(body: string, signature: string | null): boolean {
  if (!VERIFY_TOKEN || !APP_SECRET) {
    if (process.env.NODE_ENV !== 'development') return false;
    return true;
  }
  if (!signature) return false;
  const expected = 'sha256=' + createHmac('sha256', APP_SECRET).update(body).digest('hex');
  return signature === expected;
}
