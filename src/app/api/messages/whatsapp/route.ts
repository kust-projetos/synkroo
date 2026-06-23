import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runAtendimentoAction } from '@/modules/atendimento/ui/route-adapter';
import { historicoMensagens } from '@/modules/atendimento/actions/historico-mensagens';

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const sp = new URL(request.url).searchParams;
  const contactId = sp.get('contact_id') ?? sp.get('conversation_id');
  if (!contactId) return NextResponse.json({ error: 'contact_id or conversation_id required' }, { status: 400 });
  return runAtendimentoAction(historicoMensagens, {
    conversationId: contactId,
    page: sp.get('page') ?? undefined,
    limit: sp.get('limit') ?? undefined,
  });
}

const wrapped = withModuleRoute('atendimento', moduleManifest)(handleGET);
export { wrapped as GET };
