/**
 * GET    /api/procedures/[id] — get procedure by ID
 * PATCH  /api/procedures/[id] — update procedure
 * DELETE /api/procedures/[id] — soft-delete (405 Method Not Allowed via gate)
 *
 * Migrated to operacional module action system.
 * No direct DB access in this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { obterProcedimento } from '@/modules/operacional/actions/obter-procedimento';
import { atualizarProcedimento } from '@/modules/operacional/actions/atualizar-procedimento';

const OPERACIONAL_MODULE = 'operacional';

type RouteParams = { params: Promise<{ id: string }> };

async function handleGET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return runActionRoute(obterProcedimento, { id });
}

async function handlePATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json();
  return runActionRoute(atualizarProcedimento, { id, ...body });
}

async function handleDELETE(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'method_not_allowed', message: 'DELETE on procedures is not available in this API version.' },
    { status: 405 },
  );
}

const wrappedGET = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handleGET);
const wrappedPATCH = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handlePATCH);
const wrappedDELETE = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handleDELETE);

export { wrappedGET as GET, wrappedPATCH as PATCH, wrappedDELETE as DELETE };
