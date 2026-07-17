/**
 * GET  /api/waitlist — list waitlist entries
 * POST /api/waitlist — add to waitlist
 * DELETE /api/waitlist — cancel waitlist entry by id param
 *
 * Migrated to operacional module action system.
 * No direct DB access in this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { listarWaitlist } from '@/modules/operacional/actions/listar-waitlist';
import { entrarWaitlist } from '@/modules/operacional/actions/entrar-waitlist';
import { cancelarWaitlist } from '@/modules/operacional/actions/cancelar-waitlist';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';

const OPERACIONAL_MODULE = 'operacional';

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const sp = new URL(request.url).searchParams;
  return runActionRoute(listarWaitlist, {
    date: sp.get('date') ?? undefined,
    status: sp.get('status') ?? undefined,
    patientId: sp.get('patient_id') ?? undefined,
  });
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, { ...rateLimitPresets.api, keyPrefix: 'waitlist-create' });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }
  const body = await request.json();
  return runActionRoute(entrarWaitlist, body, { okStatus: 201 });
}

async function handleDELETE(request: NextRequest): Promise<NextResponse> {
  const sp = new URL(request.url).searchParams;
  const id = sp.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  return runActionRoute(cancelarWaitlist, { id, reason: sp.get('reason') ?? undefined });
}

const wrappedGET = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handleGET);
const wrappedPOST = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handlePOST);
const wrappedDELETE = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handleDELETE);

export { wrappedGET as GET, wrappedPOST as POST, wrappedDELETE as DELETE };
