import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { registrarPagamento } from '@/modules/financeiro/actions/registrar-pagamento';

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  return runFinanceiroAction(registrarPagamento, body, { okStatus: 201 });
}
export const POST = withModuleRoute('financeiro', moduleManifest)(handlePOST);
