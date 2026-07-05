import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { obterOrcamento } from '@/modules/financeiro/actions/obter-orcamento';

async function handleGET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runFinanceiroAction(obterOrcamento, { id });
}
export const GET = withModuleRoute('financeiro', moduleManifest)(handleGET);
