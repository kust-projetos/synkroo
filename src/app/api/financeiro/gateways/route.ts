import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { listarGateways } from '@/modules/financeiro/actions/listar-gateways';
import { salvarGateway } from '@/modules/financeiro/actions/salvar-gateway';

async function handleGET() {
  return runFinanceiroAction(listarGateways, {});
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  return runFinanceiroAction(salvarGateway, body, { okStatus: 201 });
}

export const GET = withModuleRoute('financeiro', moduleManifest)(handleGET);
export const POST = withModuleRoute('financeiro', moduleManifest)(handlePOST);
