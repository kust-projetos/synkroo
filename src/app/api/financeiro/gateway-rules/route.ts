import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { listarRegrasRoteamento } from '@/modules/financeiro/actions/listar-regras-roteamento';
import { salvarRegraRoteamento } from '@/modules/financeiro/actions/salvar-regra-roteamento';

async function handleGET() {
  return runFinanceiroAction(listarRegrasRoteamento, {});
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  return runFinanceiroAction(salvarRegraRoteamento, body, { okStatus: 201 });
}

export const GET = withModuleRoute('financeiro', moduleManifest)(handleGET);
export const POST = withModuleRoute('financeiro', moduleManifest)(handlePOST);
