import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { buildUserContext } from '@/core/actions/context';
import { invokeAgent } from '@/core/ia-channel/agent-invoker';
import { resolveFuncionario } from '@/core/ia-channel/interlocutor';
import { apiFailure } from '@/lib/api/response';
import { IA_CHAT_MAX_MESSAGE_LENGTH } from '@/core/ia-channel/chat-limits';
import { resolveIaTimezone } from '../timezone';
import { resolveCorrelationId } from '@/core/ia-agent/telemetry';
import { toPublicChatDto } from './dto';

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
  // Integração B1×B2: correlation id ponta a ponta (B2) — ecoa x-request-id
  // do caller quando em formato válido, senão gera um novo
  // (resolveCorrelationId); propagado a invokeAgent → issueHandle → runTurn →
  // provider e devolvido no header de TODAS as respostas. O mesmo id ancora
  // o envelope de erro canônico (requestId — B1).
  const correlationId = resolveCorrelationId(request.headers.get('x-request-id'));
  const requestId = correlationId;
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

  if (!conversationId || typeof message !== 'string' || !message) {
    return NextResponse.json(
      { error: 'conversationId e message são obrigatórios.' },
      { status: 422, headers: corrHeaders },
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
      // Integração B1×B2: tokens sanitizados na borda (B1 — não-string
      // descartados) + correlation validado (B2).
      confirmedToken: asOptionalToken(body.confirmedToken),
      identityVerifiedToken: asOptionalToken(body.identityVerifiedToken),
      correlationId,
    });
  } catch {
    // Integração B1×B2: envelope canônico (B1) com o correlation ecoado
    // no header e no requestId (B2).
    return withRequestId(
      apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500),
      requestId,
    );
  }

  // Integração B1×B2: DTO público mínimo (B2 — errorCode interno filtrado por
  // allowlist) com x-request-id ecoado.
  const res = NextResponse.json(toPublicChatDto(result), { headers: corrHeaders });
  return withRequestId(res, requestId);
}

export const POST = withModuleRoute('ia')(handlePOST);
