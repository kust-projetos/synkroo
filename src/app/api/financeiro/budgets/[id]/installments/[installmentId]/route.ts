import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { atualizarParcela } from '@/modules/financeiro/actions/atualizar-parcela';
import { deletarParcela } from '@/modules/financeiro/actions/deletar-parcela';

async function handlePATCH(request: NextRequest, { params }: { params: Promise<{ id: string; installmentId: string }> }) {
  const { id, installmentId } = await params;
  const body = await request.json();
  return runFinanceiroAction(atualizarParcela, { budgetId: id, installmentId, ...body }, { request });
}

async function handleDELETE(request: NextRequest, { params }: { params: Promise<{ id: string; installmentId: string }> }) {
  const { id, installmentId } = await params;
  return runFinanceiroAction(deletarParcela, { budgetId: id, installmentId }, { request });
}

export const PATCH = withModuleRoute('financeiro')(handlePATCH);
export const DELETE = withModuleRoute('financeiro')(handleDELETE);
