import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runAtendimentoAction } from '@/modules/atendimento/ui/route-adapter';
import { historicoMensagens } from '@/modules/atendimento/actions/historico-mensagens';

interface RouteParams { params: Promise<{ conversationId: string }>; }

async function handleGET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { conversationId } = await params;
  const sp = new URL(_request.url).searchParams;
  return runAtendimentoAction(historicoMensagens, {
    conversationId,
    page: sp.get('page') ?? undefined,
    limit: sp.get('limit') ?? undefined,
  });
}

const wrapped = withModuleRoute('atendimento', moduleManifest)(handleGET);
export { wrapped as GET };
