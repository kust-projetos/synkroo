import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated Use POST /api/cron/followups?tasks=campaigns instead.
 * Campaign processing is now handled per-clinic via the followup module action layer.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'deprecated', message: 'Use POST /api/cron/followups?tasks=campaigns' },
    { status: 410 },
  );
}
