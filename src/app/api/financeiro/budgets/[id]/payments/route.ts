import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { listarPagamentos } from '@/modules/financeiro/actions/listar-pagamentos';

async function handleGET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runFinanceiroAction(listarPagamentos, { budgetId: id });
}
export const GET = withModuleRoute('financeiro', moduleManifest)(handleGET);
