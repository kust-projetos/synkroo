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
  // 1. Extract raw bytes — must happen before any text decoding so that the
  //    HMAC is computed over the exact request body bytes (Security Task 5).
  const rawBody = Buffer.from(await request.arrayBuffer());

  // 2. Validate APP_SECRET before rate limiter
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // 3. Signature must be present
  const signature = request.headers.get('x-hub-signature-256');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 403 });
  }

  // 4. Rate limit
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, { ...rateLimitPresets.webhook, keyPrefix: 'ig-webhook' });
  if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  // 5. Strict format check: exactly "sha256=" + 64 hex digits, no whitespace
  if (!/^sha256=[0-9a-fA-F]{64}$/.test(signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  // 6. HMAC verification over raw bytes (not decoded text)
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  // 7. Parse JSON only after HMAC is verified
  const payload = JSON.parse(rawBody.toString('utf8'));
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
