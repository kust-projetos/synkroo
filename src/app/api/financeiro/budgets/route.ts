import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { listarOrcamentos } from '@/modules/financeiro/actions/listar-orcamentos';
import { criarOrcamento } from '@/modules/financeiro/actions/criar-orcamento';

async function handleGET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const input = {
    status: searchParams.get('status') ?? undefined,
    patientId: searchParams.get('patientId') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    limit: parseInt(searchParams.get('limit') ?? '50', 10),
  };
  return runFinanceiroAction(listarOrcamentos, input);
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  return runFinanceiroAction(criarOrcamento, body, { okStatus: 201 });
}

export const GET = withModuleRoute('financeiro')(handleGET);
export const POST = withModuleRoute('financeiro')(handlePOST);
