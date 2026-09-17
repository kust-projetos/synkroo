import { NextRequest, NextResponse } from 'next/server';
import { apiRateLimited, generateRequestId } from '@/lib/api/response';
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitPresets,
} from '@/lib/rate-limit';

/**
 * Login is handled exclusively by NextAuth credentials provider.
 * This stub keeps the auth brute-force preset on the path (SPEC §41):
 * abusive callers get 429 instead of probing the stub.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rateLimit = checkRateLimit(
    getClientIdentifier(request),
    rateLimitPresets.auth,
  );
  if (!rateLimit.allowed) {
    return apiRateLimited(
      generateRequestId(),
      rateLimit.retryAfter ?? 0,
      'Too many login attempts.',
    );
  }
  return new NextResponse(null, { status: 404 });
}
