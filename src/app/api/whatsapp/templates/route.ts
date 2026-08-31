import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runAtendimentoAction } from '@/modules/atendimento/ui/route-adapter';
import { obterModeloMensagem } from '@/modules/atendimento/actions/obter-modelo-mensagem';

async function handleGET(_request: NextRequest): Promise<NextResponse> {
  return runAtendimentoAction(obterModeloMensagem, {});
}

const wrapped = withModuleRoute('atendimento')(handleGET);
export { wrapped as GET };
