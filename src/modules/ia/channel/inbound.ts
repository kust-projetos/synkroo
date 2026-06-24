import type { ActionContext } from '@/core/actions/types';
import { createInterlocutorResolver } from '@/modules/ia/agent/interlocutor';
import { runOrchestratorLoop } from '@/modules/ia/agent/orchestrator';
import { createLlmProvider } from '@/modules/ia/llm/provider';

// ── Public types ──────────────────────────────────────────────

export interface InboundMessage {
  externalMessageId: string; // para dedup
  phone: string; // telefone do remetente
  clinicId: string; // clínica (resolvido pela instância Evolution)
  body: string; // texto da mensagem
}

export interface InboundResult {
  response: string; // resposta do agente
  interlocutorKind: string; // 'paciente' | 'lead' | 'desconhecido'
  turnCount: number; // quantos turns o loop usou
}

// ── Handler ───────────────────────────────────────────────────

export async function handleWhatsAppInbound(
  message: InboundMessage,
  ctx: ActionContext,
): Promise<InboundResult> {
  // 1. Resolve interlocutor
  const interlocutor = createInterlocutorResolver();
  const result = await interlocutor.resolve({
    phone: message.phone,
    clinicId: message.clinicId,
  });

  // 2. Build initial orchestrator state
  const state = {
    personaType: result.personaType,
    history: [],
    turnCount: 0,
  };

  // 3. Run orchestrator loop
  const output = await runOrchestratorLoop(
    {
      message: message.body,
      context: ctx,
      state,
    },
    {
      provider: createLlmProvider(),
      maxTurns: 10,
    },
  );

  // 4. Return result
  return {
    response: output.response,
    interlocutorKind: result.kind,
    turnCount: output.state.turnCount,
  };
}
