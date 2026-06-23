import { NextRequest, NextResponse } from 'next/server';
import { runAtendimentoSystemAction } from '@/modules/atendimento/ui/route-adapter';
import { receberWidgetMensagem } from '@/modules/atendimento/actions/receber-widget-mensagem';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

async function handleGET() {
  return NextResponse.json({
    conversation_id: null, messages: [], disabled: true,
    reason: 'legacy_agent_removed', todo: 'TODO(W5.3): reconnect to new agent',
  });
}

async function handlePOST(request: NextRequest) {
  const body = await request.json();
  const clinicId = body.clinicId || 'fallback';
  return runAtendimentoSystemAction(receberWidgetMensagem, body, clinicId);
}

export const GET = withModuleRoute('atendimento', moduleManifest)(handleGET);
export const POST = withModuleRoute('atendimento', moduleManifest)(handlePOST);
