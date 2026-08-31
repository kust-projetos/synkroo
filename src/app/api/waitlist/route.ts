/**
 * GET    /api/waitlist — list waitlist entries or get single entry by id param
 * POST   /api/waitlist — add to waitlist
 * PATCH  /api/waitlist — update waitlist entry
 * PUT    /api/waitlist — update waitlist entry
 * DELETE /api/waitlist — cancel waitlist entry by id param
 *
 * Migrated to operacional module action system.
 * No direct DB access in this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { listarWaitlist } from '@/modules/operacional/actions/listar-waitlist';
import { obterWaitlist } from '@/modules/operacional/actions/obter-waitlist';
import { entrarWaitlist } from '@/modules/operacional/actions/entrar-waitlist';
import { atualizarWaitlist } from '@/modules/operacional/actions/atualizar-waitlist';
import { cancelarWaitlist } from '@/modules/operacional/actions/cancelar-waitlist';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';

const OPERACIONAL_MODULE = 'operacional';

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const sp = new URL(request.url).searchParams;
  const id = sp.get('id');
  if (id) {
    return runActionRoute(obterWaitlist, { id });
  }

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

async function handlePATCH(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  return runActionRoute(atualizarWaitlist, body);
}

async function handleDELETE(request: NextRequest): Promise<NextResponse> {
  const sp = new URL(request.url).searchParams;
  const id = sp.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  return runActionRoute(cancelarWaitlist, { id, reason: sp.get('reason') ?? undefined });
}

const wrappedGET = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handleGET);
const wrappedPOST = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handlePOST);
const wrappedPATCH = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handlePATCH);
const wrappedDELETE = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handleDELETE);

export {
  wrappedGET as GET,
  wrappedPOST as POST,
  wrappedPATCH as PATCH,
  wrappedPATCH as PUT,
  wrappedDELETE as DELETE,
};
