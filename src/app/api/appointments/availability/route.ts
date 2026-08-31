/**
 * GET /api/appointments/availability
 *
 * Returns available time slots for a dentist on a given date.
 * Replaces the previous legacy stub with the operational action adapter.
 * No direct DB access in this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { consultarDisponibilidade } from '@/modules/operacional/actions/consultar-disponibilidade';

interface RouteParams { params: Promise<Record<string, string>>; }

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const sp = new URL(request.url).searchParams;
  const dentistId = sp.get('dentistId');
  const date = sp.get('date');
  const slotMinutes = sp.get('slotMinutes');

  if (!dentistId || !date) {
    return NextResponse.json(
      { error: 'dentistId and date query parameters are required' },
      { status: 400 },
    );
  }

  const input: Record<string, unknown> = { dentistId, date };
  if (slotMinutes) input.slotMinutes = Number(slotMinutes);

  return runActionRoute(consultarDisponibilidade, input);
}

const wrapped = withModuleRoute('operacional')(handleGET);
export { wrapped as GET };
