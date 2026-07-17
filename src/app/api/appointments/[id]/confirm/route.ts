/**
 * POST /api/appointments/[id]/confirm
 *
 * Migrated to operacional module action system.
 * Uses operacional.confirmarConsulta.
 * No direct DB access in this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { confirmarConsulta } from '@/modules/operacional/actions/confirmar-consulta';

interface RouteParams { params: Promise<{ id: string }>; }

async function handlePOST(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return runActionRoute(confirmarConsulta, { id });
}

const wrapped = withModuleRoute('operacional', moduleManifest)(handlePOST);
export { wrapped as POST };
