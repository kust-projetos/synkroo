import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth/auth';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { apiRateLimited, generateRequestId } from '@/lib/api/response';

const handler = NextAuth(authOptions);

// GET (session polling) sem limiter — só o POST de credential sign-in/out é
// gated, com preset generoso (api: 60 req/min/IP + bucket próprio) para não
// quebrar E2E (login com retries).
export const GET = handler;

export async function POST(request: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  const rateLimit = checkRateLimit(getClientIdentifier(request), {
    ...rateLimitPresets.api,
    keyPrefix: 'nextauth',
  });
  if (!rateLimit.allowed) {
    return apiRateLimited(generateRequestId(), rateLimit.retryAfter, 'Too many requests.');
  }
  return (handler as unknown as (req: NextRequest, c: typeof ctx) => Promise<Response>)(request, ctx);
}
