import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { listarPagamentos } from '@/modules/financeiro/actions/listar-pagamentos';
import { registrarPagamento } from '@/modules/financeiro/actions/registrar-pagamento';

async function handleGET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runFinanceiroAction(listarPagamentos, { budgetId: id }, { request });
}

async function handlePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  return runFinanceiroAction(registrarPagamento, { budgetId: id, ...body }, { request, okStatus: 201 });
}

export const GET = withModuleRoute('financeiro')(handleGET);
export const POST = withModuleRoute('financeiro')(handlePOST);
