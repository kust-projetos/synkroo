import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { buildUserContext } from '@/core/actions/context';
import { invokeAgent } from '@/core/ia-channel/agent-invoker';
import { resolveFuncionario } from '@/core/ia-channel/interlocutor';
import { apiFailure, apiRateLimited } from '@/lib/api/response';
import {
  checkRateLimit,
  rateLimitPresets,
} from '@/lib/rate-limit';
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

// Etapa 2.5 (SYN-API-003): `chat/dto.ts` valida só a SAÍDA (toPublicChatDto).
// A entrada tinha checagem manual que aceitava `conversationId` não-string
// (só testava truthiness) e repassava ao invokeAgent. Schema de runtime na
// borda; falhas mantêm o contrato 422 existente da rota. O teto de `message`
// continua no gate dedicado abaixo (400 PAYLOAD_TOO_LARGE), por isso o schema
// não repete o `.max()` — evita mascarar o envelope canônico daquele gate.
const iaChatBodySchema = z.object({
  conversationId: z.string().min(1),
  message: z.string().min(1),
  // Tokens: `z.unknown()` deliberado — o contrato B1 tolera não-string e os
  // descarta via `asOptionalToken` (teste fixado); o schema só ancora a forma.
  confirmedToken: z.unknown().optional(),
  identityVerifiedToken: z.unknown().optional(),
});

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

  // Auth-before-limiter (padrão cron/webhook): sessão + RBAC `ia:chat`
  // validados acima, então o bucket por usuário não é consumido por
  // chamadas não autenticadas. Chave por userId (não por IP) impede
  // bypass por rotação de IP num endpoint de IA com custo por chamada.
  const chatLimit = checkRateLimit(`user:${userId}`, {
    ...rateLimitPresets.messages,
    keyPrefix: 'ia-chat',
  });
  if (!chatLimit.allowed) {
    return withRequestId(
      apiRateLimited(requestId, chatLimit.retryAfter ?? 0, 'Rate limit exceeded.'),
      requestId,
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = iaChatBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'conversationId e message são obrigatórios.' },
      { status: 422, headers: corrHeaders },
    );
  }
  const conversationId: string = parsed.data.conversationId;
  const message: string = parsed.data.message;

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
      confirmedToken: asOptionalToken(parsed.data.confirmedToken),
      identityVerifiedToken: asOptionalToken(parsed.data.identityVerifiedToken),
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
