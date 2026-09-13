import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { buildUserContext } from '@/core/actions/context';
import { invokeAgent } from '@/core/ia-channel/agent-invoker';
import { resolveFuncionario } from '@/core/ia-channel/interlocutor';
import { apiFailure, generateRequestId } from '@/lib/api/response';
import { resolveIaTimezone } from '../timezone';

/**
 * B1 (transporte): teto do `message` aceito no chat do agente.
 *
 * 4.000 chars ≈ ~1k tokens — folga para mensagens longas legítimas (colar
 * texto/relato clínico) sem deixar um payload gigante ir ao DO storage
 * (janela de 20 turnos persistida por conversa) nem ao provider a cada turno.
 * Rejeição explícita (400, sem truncar silenciosamente) para o caller saber
 * que precisa encurtar/dividir a mensagem.
 */
export const IA_CHAT_MAX_MESSAGE_LENGTH = 4000;

function withRequestId(res: NextResponse, requestId: string): NextResponse {
  res.headers.set('x-request-id', requestId);
  return res;
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const requestId = request.headers.get('x-request-id') ?? generateRequestId();
  // buildUserContext lança 'unauthenticated' sem sessão; dá user + can (RBAC real).
  let ctx: Awaited<ReturnType<typeof buildUserContext>>;
  try {
    ctx = await buildUserContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // autorização específica: exige ia:chat (não basta o módulo ativo).
  if (!ctx.can('ia:chat')) {
    return NextResponse.json({ error: 'Sem permissão para o assistente.' }, { status: 403 });
  }

  const userId = ctx.user!.id;
  const name = ctx.user!.name;
  const clinicId = ctx.clinicId;

  const body = await request.json().catch(() => ({}));
  const conversationId: string = body.conversationId;
  const message: string = body.message;

  if (!conversationId || typeof message !== 'string' || !message) {
    return NextResponse.json(
      { error: 'conversationId e message são obrigatórios.' },
      { status: 422 },
    );
  }

  if (message.length > IA_CHAT_MAX_MESSAGE_LENGTH) {
    return withRequestId(
      apiFailure(
        'PAYLOAD_TOO_LARGE',
        `message excede o limite de ${IA_CHAT_MAX_MESSAGE_LENGTH} caracteres.`,
        requestId,
        400,
      ),
      requestId,
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
    });
  } catch {
    return withRequestId(
      apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500),
      requestId,
    );
  }

  const res = NextResponse.json(result);
  return withRequestId(res, requestId);
}

export const POST = withModuleRoute('ia')(handlePOST);
