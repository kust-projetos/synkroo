import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runAtendimentoAction } from '@/modules/atendimento/ui/route-adapter';
import { listarConversas } from '@/modules/atendimento/actions/listar-conversas';

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const sp = new URL(request.url).searchParams;
  return runAtendimentoAction(listarConversas, {
    status: sp.get('status') ?? undefined,
    channel: sp.get('channel') ?? undefined,
    page: sp.get('page') ?? undefined,
    limit: sp.get('limit') ?? undefined,
  });
}

const wrapped = withModuleRoute('atendimento', moduleManifest)(handleGET);
export { wrapped as GET };
