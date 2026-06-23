import { NextRequest, NextResponse } from 'next/server';
import { runAtendimentoSystemAction } from '@/modules/atendimento/ui/route-adapter';
import { receberWidgetMensagem } from '@/modules/atendimento/actions/receber-widget-mensagem';

export async function GET() {
  return NextResponse.json({
    conversation_id: null, messages: [], disabled: true,
    reason: 'legacy_agent_removed', todo: 'TODO(W5.3): reconnect to new agent',
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const clinicId = body.clinicId || 'fallback';
  return runAtendimentoSystemAction(receberWidgetMensagem, body, clinicId);
}
