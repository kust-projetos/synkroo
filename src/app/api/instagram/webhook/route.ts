import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { processInstagramEntry } from '@/modules/atendimento/services/webhook-processor-service';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN;

async function handleGET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const mode = sp.get('hub.mode');
  const token = sp.get('hub.verify_token');
  const challenge = sp.get('hub.challenge');
  if (mode === 'subscribe' && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

async function handlePOST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, { ...rateLimitPresets.webhook, keyPrefix: 'ig-webhook' });
  if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const signature = request.headers.get('x-hub-signature-256');
  const body = await request.text();
  const APP_SECRET = process.env.INSTAGRAM_APP_SECRET || '';
  if (VERIFY_TOKEN && APP_SECRET && signature) {
    const expected = 'sha256=' + createHmac('sha256', APP_SECRET).update(body).digest('hex');
    if (signature !== expected) return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const payload = JSON.parse(body);
  if (payload.object !== 'instagram') return NextResponse.json({ status: 'ignored' });

  const entries = payload.entry || [];
  const allResults: Array<{ from: string; message: string }> = [];

  for (const entry of entries) {
    const results = await processInstagramEntry(entry);
    allResults.push(...results);
  }

  return NextResponse.json({
    success: true, processed: allResults.length, messages: allResults,
    ai_enabled: false, reason: 'legacy_agent_removed', todo: 'TODO(W5.3): reconnect to new agent',
  });
}

export const GET = withModuleRoute('atendimento', moduleManifest)(handleGET);
export const POST = withModuleRoute('atendimento', moduleManifest)(handlePOST);
