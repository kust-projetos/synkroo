/**
 * POST /api/waitlist/fill — Idempotently fill slot from waitlist
 *
 * Migrated to operacional module action system.
 * Uses SELECT ... FOR UPDATE locking inside transaction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { preencherWaitlist } from '@/modules/operacional/actions/preencher-waitlist';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';

const OPERACIONAL_MODULE = 'operacional';

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, { ...rateLimitPresets.api, keyPrefix: 'waitlist-fill' });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }
  const body = await request.json();
  return runActionRoute(preencherWaitlist, body, { okStatus: 200 });
}

const wrappedPOST = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handlePOST);

export { wrappedPOST as POST };
