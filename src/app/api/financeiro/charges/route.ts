import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { gerarCobranca } from '@/modules/financeiro/actions/gerar-cobranca';

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  return runFinanceiroAction(gerarCobranca, body, { okStatus: 201 });
}
export const POST = withModuleRoute('financeiro', moduleManifest)(handlePOST);
