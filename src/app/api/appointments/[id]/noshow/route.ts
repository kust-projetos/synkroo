/**
 * POST /api/appointments/[id]/noshow
 *
 * Migrated to operacional module action system.
 * Uses operacional:registrar_no_show action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { registrarNoShow } from '@/modules/operacional/actions/registrar-no-show';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function handlePOST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return runActionRoute(registrarNoShow, request, { urlParams: { appointmentId: id } });
}

export { handlePOST as POST };
