import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { cancelarCobranca } from '@/modules/financeiro/actions/cancelar-cobranca';

async function handlePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runFinanceiroAction(cancelarCobranca, { id });
}
export const POST = withModuleRoute('financeiro', moduleManifest)(handlePOST);
