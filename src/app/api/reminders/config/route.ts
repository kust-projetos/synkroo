/**
 * GET /api/reminders/config — list reminder configs for clinic
 * PUT /api/reminders/config — upsert reminder config
 *
 * Migrated to operacional module action system.
 * No direct DB access in this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { listarConfigsLembrete } from '@/modules/operacional/actions/listar-configs-lembrete';
import { salvarConfigLembrete } from '@/modules/operacional/actions/salvar-config-lembrete';

const OPERACIONAL_MODULE = 'operacional';

async function handleGET(): Promise<NextResponse> {
  return runActionRoute(listarConfigsLembrete, {});
}

async function handlePUT(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  return runActionRoute(salvarConfigLembrete, body);
}

const wrappedGET = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handleGET);
const wrappedPUT = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handlePUT);

export { wrappedGET as GET, wrappedPUT as PUT };
