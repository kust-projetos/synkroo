import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { enviarLembreteCobranca } from '@/modules/financeiro/actions/enviar-lembrete-cobranca';

async function handlePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runFinanceiroAction(enviarLembreteCobranca, { chargeId: id });
}
export const POST = withModuleRoute('financeiro')(handlePOST);
