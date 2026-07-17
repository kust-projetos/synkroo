/**
 * GET  /api/patients/[id] — get patient by ID
 * PUT  /api/patients/[id] — update patient
 * PATCH /api/patients/[id] — update patient (partial)
 * DELETE /api/patients/[id] — deprecated (410 Gone)
 *
 * Migrated to operacional module action system.
 * No direct DB access in this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { obterPaciente } from '@/modules/operacional/actions/obter-paciente';
import { atualizarPaciente } from '@/modules/operacional/actions/atualizar-paciente';

const OPERACIONAL_MODULE = 'operacional';

interface RouteParams { params: Promise<{ id: string }>; }

async function handleGET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return runActionRoute(obterPaciente, { id });
}

async function handlePUT(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json();
  return runActionRoute(atualizarPaciente, { id, ...body });
}

async function handlePATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json();
  return runActionRoute(atualizarPaciente, { id, ...body });
}

async function handleDELETE(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'deprecated', message: 'DELETE on patients is not available in this API version.' },
    { status: 410 },
  );
}

const wrappedGET = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handleGET);
const wrappedPUT = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handlePUT);
const wrappedPATCH = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handlePATCH);
const wrappedDELETE = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handleDELETE);

export { wrappedGET as GET, wrappedPUT as PUT, wrappedPATCH as PATCH, wrappedDELETE as DELETE };
