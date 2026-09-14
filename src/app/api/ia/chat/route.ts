import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { buildUserContext } from '@/core/actions/context';
import { invokeAgent } from '@/core/ia-channel/agent-invoker';
import { resolveFuncionario } from '@/core/ia-channel/interlocutor';
import { resolveIaTimezone } from '../timezone';
import { resolveCorrelationId } from '@/core/ia-agent/telemetry';
import { toPublicChatDto } from './dto';

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  // B2: correlation id ponta a ponta — ecoa x-request-id do caller quando em
  // formato válido, senão gera um novo (resolveCorrelationId); propagado a
  // invokeAgent → issueHandle → runTurn → provider e devolvido no header de
  // TODAS as respostas para rastreabilidade do incidente.
  const correlationId = resolveCorrelationId(request.headers.get('x-request-id'));
  const corrHeaders = { 'x-request-id': correlationId };

  // buildUserContext lança 'unauthenticated' sem sessão; dá user + can (RBAC real).
  let ctx: Awaited<ReturnType<typeof buildUserContext>>;
  try {
    ctx = await buildUserContext();
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corrHeaders },
    );
  }

  // autorização específica: exige ia:chat (não basta o módulo ativo).
  if (!ctx.can('ia:chat')) {
    return NextResponse.json(
      { error: 'Sem permissão para o assistente.' },
      { status: 403, headers: corrHeaders },
    );
  }

  const userId = ctx.user!.id;
  const name = ctx.user!.name;
  const clinicId = ctx.clinicId;

  const body = await request.json().catch(() => ({}));
  const conversationId: string = body.conversationId;
  const message: string = body.message;

  if (!conversationId || !message) {
    return NextResponse.json(
      { error: 'conversationId e message são obrigatórios.' },
      { status: 422, headers: corrHeaders },
    );
  }

  const who = resolveFuncionario(userId, name);
  let result;
  try {
    result = await invokeAgent({
      clinicId,
      conversationId,
      channel: 'chat',
      peerId: userId,
      principalRef: userId,
      source: 'agent_delegated',
      personaType: who.personaType,
      context: who.context,
      timezone: resolveIaTimezone(),
      userMessage: message,
      confirmedToken: body.confirmedToken,
      identityVerifiedToken: body.identityVerifiedToken,
      correlationId,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error', turnsUsed: 0 },
      { status: 500, headers: corrHeaders },
    );
  }

  return NextResponse.json(toPublicChatDto(result), { headers: corrHeaders });
}

export const POST = withModuleRoute('ia')(handlePOST);
