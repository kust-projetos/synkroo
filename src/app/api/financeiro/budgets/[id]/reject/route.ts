import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { rejeitarOrcamento } from '@/modules/financeiro/actions/rejeitar-orcamento';

async function handlePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runFinanceiroAction(rejeitarOrcamento, { id });
}
export const POST = withModuleRoute('financeiro')(handlePOST);
