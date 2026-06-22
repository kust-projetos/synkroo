/**
 * POST /api/appointments/[id]/cancel
 *
 * Migrated to operacional module action system.
 * Uses operacional:cancelar_consulta action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { cancelarConsulta } from '@/modules/operacional/actions/cancelar-consulta';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function handlePOST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return runActionRoute(cancelarConsulta, request, { urlParams: { appointmentId: id } });
}

export { handlePOST as POST };
