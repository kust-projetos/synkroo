import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { listarParcelas } from '@/modules/financeiro/actions/listar-parcelas';
import { salvarParcelas } from '@/modules/financeiro/actions/salvar-parcelas';

async function handleGET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runFinanceiroAction(listarParcelas, { budgetId: id });
}

async function handlePUT(request: NextRequest, { params }: { params: Promi
