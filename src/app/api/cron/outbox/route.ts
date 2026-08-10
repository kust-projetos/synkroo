import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { outboxOperations, processOutboxBatch } from '@/lib/outbox/worker';

function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get('Authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  return Boolean(process.env.CRON_SECRET)
    && provided.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const batchSize = Math.min(Math.max(Number(new URL(request.url).searchParams.get('limit') ?? 25), 1), 100);
  const results = await processOutboxBatch(batchSize);
  return NextResponse.json({ success: true, processed: results.filter((result) => result.status !== 'empty').length, results });
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Outbox worker is active', operations: outboxOperations });
}
