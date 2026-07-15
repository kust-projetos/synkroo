import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { processInstagramEntry } from '@/modules/atendimento/services/webhook-processor-service';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

async function handleGET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN;
  if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

async function handlePOST(request: NextRequest) {
  const body = await request.text();

  // 1. Validate APP_SECRET before rate limiter
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // 2. Signature must be present
  const signature = request.headers.get('x-hub-signature-256');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 403 });
  }

  // 3. Rate limit
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, { ...rateLimitPresets.webhook, keyPrefix: 'ig-webhook' });
  if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  // 4. HMAC validation with equal-length guard + timingSafeEqual
  if (!signature.startsWith('sha256=')) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }
  const expectedHex = createHmac('sha256', appSecret).update(body).digest('hex');
  const expected = 'sha256=' + expectedHex;
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
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
