/**
 * POST /api/appointments/[id]/reschedule
 *
 * Migrated to operacional module action system.
 * Uses operacional.remarcarConsulta.
 * No direct DB access in this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { remarcarConsulta } from '@/modules/operacional/actions/remarcar-consulta';

interface RouteParams { params: Promise<{ id: string }>; }

async function handlePOST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return runActionRoute(remarcarConsulta, { id, ...body });
}

const wrapped = withModuleRoute('operacional', moduleManifest)(handlePOST);
export { wrapped as POST };
