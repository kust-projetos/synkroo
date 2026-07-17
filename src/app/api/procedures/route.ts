/**
 * GET  /api/procedures — list procedures
 * POST /api/procedures — create procedure
 *
 * Migrated to operacional module action system.
 * No direct DB access in this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { criarProcedimento } from '@/modules/operacional/actions/criar-procedimento';
import { listarProcedimentos } from '@/modules/operacional/actions/listar-procedimentos';

const OPERACIONAL_MODULE = 'operacional';

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const sp = new URL(request.url).searchParams;
  return runActionRoute(listarProcedimentos, {
    activeOnly: sp.get('activeOnly') === 'true',
  });
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  return runActionRoute(criarProcedimento, body, { okStatus: 201 });
}

const wrappedGET = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handleGET);
const wrappedPOST = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handlePOST);

export { wrappedGET as GET, wrappedPOST as POST };
