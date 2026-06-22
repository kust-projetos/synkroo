/**
 * GET  /api/appointments — list with filters + pagination
 * POST /api/appointments — create appointment
 *
 * Migrated to operacional module action system.
 * Uses operacional:listar_consultas and operacional:agendar_consulta actions.
 * No direct DB access in this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { agendarConsulta } from '@/modules/operacional/actions/agendar-consulta';
import { listarConsultas } from '@/modules/operacional/actions/listar-consultas';

const OPERACIONAL_MODULE = 'operacional';

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, rateLimitPresets.api);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

  const result = await runActionRoute(listarConsultas, request);
  // Override: listarConsultas returns { appointments, pagination } directly
  // — NextResponse already built by runActionRoute
  return result;
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, rateLimitPresets.api);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

  const result = await runActionRoute(agendarConsulta, request);
  if (result.status === 200) {
    // POST creates → return 201
    const body = await result.json();
    return NextResponse.json({ appointment: body }, { status: 201 });
  }
  return result;
}

const wrappedGET = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handleGET);
const wrappedPOST = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handlePOST);

export { wrappedGET as GET, wrappedPOST as POST };
