/**
 * GET  /api/dentists/[id] — get dentist by ID
 * PATCH /api/dentists/[id] — update dentist
 * DELETE /api/dentists/[id] — soft-delete (405 Method Not Allowed via gate)
 *
 * Migrated to operacional module action system.
 * No direct DB access in this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { obterDentista } from '@/modules/operacional/actions/obter-dentista';
import { atualizarDentista } from '@/modules/operacional/actions/atualizar-dentista';

const OPERACIONAL_MODULE = 'operacional';

type RouteParams = { params: Promise<{ id: string }> };

async function handleGET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return runActionRoute(obterDentista, { id });
}

async function handlePATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json();
  return runActionRoute(atualizarDentista, { id, ...body });
}

async function handleDELETE(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'method_not_allowed', message: 'DELETE on dentists is not available in this API version.' },
    { status: 405 },
  );
}

const wrappedGET = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handleGET);
const wrappedPATCH = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handlePATCH);
const wrappedDELETE = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handleDELETE);

export { wrappedGET as GET, wrappedPATCH as PATCH, wrappedDELETE as DELETE };
