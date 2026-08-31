import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { processarConfirmacaoResposta } from '@/modules/operacional/actions/processar-confirmacao-resposta';

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  return runActionRoute(processarConfirmacaoResposta, body);
}

const wrapped = withModuleRoute('operacional')(handlePOST);
export { wrapped as POST };
