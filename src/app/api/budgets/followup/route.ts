/**
 * GET /api/budgets/followup — list unconverted budgets needing follow-up
 * POST /api/budgets/followup — process all pending budget follow-ups
 *
 * Uses followup.listarOrcamentosPendentes + followup.executarFollowupOrcamentos.
 * Module gate: withModuleRoute('followup').
 */
import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/followup/ui/route-adapter';
import { listarOrcamentosPendentes, executarFollowupOrcamentos } from '@/modules/followup/actions';

async function handleGET(request: NextRequest): Promise<NextResponse> {
  return runActionRoute(listarOrcamentosPendentes, {});
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  return runActionRoute(executarFollowupOrcamentos, {});
}

const wrappedGET = withModuleRoute('followup', moduleManifest)(handleGET);
const wrappedPOST = withModuleRoute('followup', moduleManifest)(handlePOST);

export { wrappedGET as GET, wrappedPOST as POST };
