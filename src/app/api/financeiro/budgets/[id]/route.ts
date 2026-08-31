import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { obterOrcamento } from '@/modules/financeiro/actions/obter-orcamento';
import { atualizarOrcamento } from '@/modules/financeiro/actions/atualizar-orcamento';
import { arquivarOrcamento } from '@/modules/financeiro/actions/arquivar-orcamento';

async function handleGET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runFinanceiroAction(obterOrcamento, { id }, { request });
}

async function handlePUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  return runFinanceiroAction(atualizarOrcamento, { id, ...body }, { request });
}

async function handleDELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runFinanceiroAction(arquivarOrcamento, { id }, { request });
}

export const GET = withModuleRoute('financeiro')(handleGET);
export const PUT = withModuleRoute('financeiro')(handlePUT);
export const DELETE = withModuleRoute('financeiro')(handleDELETE);
