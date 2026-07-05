import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { buildUserContext } from '@/core/actions/context';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { salvarGateway } from '@/modules/financeiro/actions/salvar-gateway';
import { listGateways } from '@/modules/financeiro/services/gateway-config-service';

async function handleGET() {
  const ctx = await buildUserContext();
  const gateways = await listGateways(ctx.clinicId);
  return NextResponse.json({ data: gateways });
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  return runFinanceiroAction(salvarGateway, body, { okStatus: 201 });
}

export const GET = withModuleRoute('financeiro', moduleManifest)(handleGET);
export const POST = withModuleRoute('financeiro', moduleManifest)(handlePOST);
