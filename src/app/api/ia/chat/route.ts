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

/**
 * B1 (tokens): o body só transporta os tokens de confirmação quando são
 * strings não-vazias. Valores não-string (número, array, objeto) são
 * descartados aqui — o comparador do orchestrator (`===` contra o
 * `pendingAction.token` do DO) já os rejeitaria, mas descartar na borda
 * impede que tipo inesperado chegue ao fluxo IA.
 *
 * Desenho (decisão B1 — ver FINDINGS do coder): os tokens CONTINUAM sendo
 * repassados, porque o path de chat é o único canal de confirmação
 * ("sim, confirmo") — não há endpoint separado de confirm, e remover os
 * campos quebraria o fluxo legítimo. Segurança vem de outro lugar:
 *  - o token é opaco e server-issued (randomUUID por pendingAction);
 *  - a comparação é feita contra o pendingAction que o DO injeta do
 *    próprio storage (o caller NÃO pode injetar pendingAction: a assinatura
 *    do DO é `Omit<RunTurnInput, 'history' | 'pendingAction'>`);
 *  - o DO é shardado por `clinicId:channel:conversationId`, e clinicId vem
 *    da sessão autenticada (RBAC `ia:chat`), não do body — token de outra
 *    conversa/clínica não encontra pendingAction correspondente.
 * HMAC emissor+conversationId+exp seria redundante com esse binding.
 */
function asOptionalToken(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
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
      confirmedToken: asOptionalToken(body.confirmedToken),
      identityVerifiedToken: asOptionalToken(body.identityVerifiedToken),
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
