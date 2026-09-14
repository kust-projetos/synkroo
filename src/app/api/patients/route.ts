/**
 * GET  /api/patients — list patients with optional search + pagination
 * POST /api/patients — create patient (dedup by phone + CPF)
 *
 * Migrated to operacional module action system.
 * No direct DB access in this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { apiRateLimited, generateRequestId } from '@/lib/api/response';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { criarPaciente } from '@/modules/operacional/actions/criar-paciente';
import { listarPacientes } from '@/modules/operacional/actions/listar-pacientes';

const OPERACIONAL_MODULE = 'operacional';

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, rateLimitPresets.api);
  if (!rateLimit.allowed) {
    return apiRateLimited(generateRequestId(), rateLimit.retryAfter ?? 0);
  }
  const sp = new URL(request.url).searchParams;
  const input = {
    search: sp.get('search') ?? undefined,
    limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    offset: sp.get('page') ? (Number(sp.get('page')) - 1) * (Number(sp.get('limit')) || 20) : undefined,
  };
  return runActionRoute(listarPacientes, input);
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, rateLimitPresets.api);
  if (!rateLimit.allowed) {
    return apiRateLimited(generateRequestId(), rateLimit.retryAfter ?? 0);
  }
  const body = await request.json();
  return runActionRoute(criarPaciente, body, { okStatus: 201 });
}

const wrappedGET = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handleGET);
const wrappedPOST = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handlePOST);

export { wrappedGET as GET, wrappedPOST as POST };
