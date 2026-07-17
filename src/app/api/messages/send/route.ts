import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runAtendimentoAction } from '@/modules/atendimento/ui/route-adapter';
import { enviarMensagem } from '@/modules/atendimento/actions/enviar-mensagem';

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  return runAtendimentoAction(enviarMensagem, body, { okStatus: 201 });
}

const wrapped = withModuleRoute('atendimento', moduleManifest)(handlePOST);
export { wrapped as POST };
