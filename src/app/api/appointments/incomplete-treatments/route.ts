/**
 * GET /api/appointments/incomplete-treatments — list incomplete treatments
 *
 * Migrated from operacional → followup module.
 * Uses followup.listarTratamentosIncompletos.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/followup/ui/route-adapter';
import { listarTratamentosIncompletos } from '@/modules/followup/actions';

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const sp = new URL(request.url).searchParams;
  return runActionRoute(listarTratamentosIncompletos, {
    alertsOnly: sp.get('alerts_only') === 'true' || undefined,
  });
}

const wrapped = withModuleRoute('followup', moduleManifest)(handleGET);
export { wrapped as GET };
