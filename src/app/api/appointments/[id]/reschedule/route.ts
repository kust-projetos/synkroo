/**
 * POST /api/appointments/[id]/reschedule
 *
 * Migrated to operacional module action system.
 * Uses operacional:remarcar_consulta action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { remarcarConsulta } from '@/modules/operacional/actions/remarcar-consulta';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function handlePOST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return runActionRoute(remarcarConsulta, request, { urlParams: { appointmentId: id } });
}

export { handlePOST as POST };
