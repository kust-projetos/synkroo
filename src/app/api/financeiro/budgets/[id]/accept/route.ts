import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { aceitarOrcamento } from '@/modules/financeiro/actions/aceitar-orcamento';

async function handlePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runFinanceiroAction(aceitarOrcamento, { id });
}
export const POST = withModuleRoute('financeiro', moduleManifest)(handlePOST);
