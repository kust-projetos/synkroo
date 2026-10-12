import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { outboxOperations, processOutboxBatch } from '@/lib/outbox/worker';
import { getConsumerRelease } from '@/lib/outbox/consumer-release';
import { getOutboxControlStatus, OutboxControlError } from '@/lib/outbox/control';
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit';
import { apiRateLimited, generateRequestId } from '@/lib/api/response';

function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get('Authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  return Boolean(process.env.CRON_SECRET)
    && provided.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Auth-before-limiter (padrão cleanup.ts): credencial inválida não consome quota.
  const rateLimit = checkRateLimit('cron', rateLimitPresets.cron);
  if (!rateLimit.allowed) {
    return apiRateLimited(generateRequestId(), rateLimit.retryAfter);
  }
  const batchSize = Math.min(Math.max(Number(new URL(request.url).searchParams.get('limit') ?? 25), 1), 100);
  const results = await processOutboxBatch(batchSize);
  return NextResponse.json({ success: true, processed: results.filter((result) => result.status !== 'empty').length, results });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [releaseId, control] = await Promise.all([
      getConsumerRelease(),
      getOutboxControlStatus(),
    ]);
    if (releaseId === null) {
      return NextResponse.json({ status: 'unavailable', reason: 'outbox-release-unknown' }, { status: 503 });
    }
    return NextResponse.json({
      status: control.paused ? 'paused' : 'running',
      releaseId,
      controlEpoch: control.epoch,
      controlReleaseId: control.releaseId,
      processing: control.counts.processing,
      drained: control.drained,
      operations: outboxOperations,
    });
  } catch (error) {
    const reason = error instanceof OutboxControlError ? error.code : 'OUTBOX_CONTROL_UNAVAILABLE';
    return NextResponse.json({ status: 'unavailable', reason }, { status: 503 });
  }
}
