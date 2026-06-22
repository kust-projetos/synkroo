/**
 * POST /api/appointments/[id]/confirm
 *
 * Migrated to operacional module action system.
 * Uses operacional:confirmar_consulta action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { confirmarConsulta } from '@/modules/operacional/actions/confirmar-consulta';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function handlePOST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return runActionRoute(confirmarConsulta, request, { urlParams: { appointmentId: id } });
}

export { handlePOST as POST };
