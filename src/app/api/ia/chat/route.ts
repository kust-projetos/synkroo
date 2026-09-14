import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { buildUserContext } from '@/core/actions/context';
import { invokeAgent } from '@/core/ia-channel/agent-invoker';
import { resolveFuncionario } from '@/core/ia-channel/interlocutor';
import { resolveIaTimezone } from '../timezone';
import type { RunTurnResult } from '@/core/ia-agent/types';

/**
 * Códigos internos liberados no DTO público (allowlist explícita).
 * Todo o resto de `errorCode` fica só no log correlacionado, nunca no HTTP.
 */
const PUBLIC_ERROR_CODES: ReadonlySet<string> = new Set(['rpc_timeout']);

/** Mapeia o resultado interno para o DTO público mínimo do chat. */
export function toPublicChatDto(result: RunTurnResult): Record<string, unknown> {
  const dto: Record<string, unknown> = {
    reply: result.reply,
    turnsUsed: result.turnsUsed,
  };
  if (result.escalated !== undefined) dto.escalated = result.escalated;
  if (result.escalationReason) dto.escalationReason = result.escalationReason;
  if (result.pendingAction) dto.pendingAction = result.pendingAction;
  if (result.errorCode && PUBLIC_ERROR_CODES.has(result.errorCode)) {
    dto.errorCode = result.errorCode;
  }
  return dto;
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  // B2: correlation id ponta a ponta — ecoa x-request-id do caller ou gera um
  // novo; propagado a invokeAgent → issueHandle → runTurn → provider e
  // devolvido no header da resposta para rastreabilidade do incidente.
  const correlationId =
    request.headers.get('x-request-id') ?? crypto.randomUUID();
  const corrHeaders = { 'x-request-id': correlationId };

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

  if (!conversationId || !message) {
    return NextResponse.json(
      { error: 'conversationId e message são obrigatórios.' },
      { status: 422 },
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
