import type {
  AppBinding,
  ChatMessage,
  LlmProvider,
  LlmTool,
  RunTurnInput,
  RunTurnResult,
} from './types';
import { BRIDGE_RPC_VERSION } from '@/core/agent-bridge/rpc-contract';
import { personaSystemPrompt } from './personas';
import { analyzeClinicalSafety } from './clinical-safety';

export interface RunTurnDeps {
  provider: LlmProvider;
  app: AppBinding;
  now: Date;
  maxIterations?: number;
  newToken?: () => string;
}

const FALLBACK = 'Só um momento — vou verificar e já te retorno.';

function errorReply(error: string): string {
  if (error === 'escalate_human')
    return 'Vou encaminhar você para um atendente da clínica para concluir isso. Um instante.';
  return 'Não consegui concluir agora. Posso ajudar de outra forma?';
}

async function hasCurrentBridgeContract(app: AppBinding): Promise<boolean> {
  try {
    const ping = await app.ping({ contractVersion: BRIDGE_RPC_VERSION });
    return ping.ok && ping.contractVersion === BRIDGE_RPC_VERSION;
  } catch {
    return false;
  }
}

export async function runTurn(
  deps: RunTurnDeps,
  input: RunTurnInput,
): Promise<RunTurnResult> {
  const maxIterations = deps.maxIterations ?? 5;
  const newToken = deps.newToken ?? (() => crypto.randomUUID());

  // ── 0. Clinical Safety & Takeover Interception ─────────────────────────────
  if (input.userMessage && input.userMessage.trim().length > 0) {
    const safety = analyzeClinicalSafety(input.userMessage);
    if (safety.requiresEscalation) {
      return {
        reply: safety.reply ?? errorReply('escalate_human'),
        turnsUsed: 0,
        escalated: true,
        escalationReason: safety.escalationReason,
      };
    }
    if (safety.isAiIdentityQuery && safety.reply) {
      return {
        reply: safety.reply,
        turnsUsed: 0,
      };
    }
  }

  // O handshake é por turno para não deixar uma versão de bridge presa no
  // isolate. Nenhuma operação de tool é enviada sem confirmar v2.
  if (!(await hasCurrentBridgeContract(deps.app))) {
    return { reply: FALLBACK, turnsUsed: 0 };
  }

  // ── Caminho de confirmação ────────────────────────────────────────────────
  // Reexecuta os args ORIGINAIS (não os do modelo). Vincula alias+args.
  if (
    input.pendingAction &&
    input.confirmedToken &&
    input.confirmedToken === input.pendingAction.token
  ) {
    const pa = input.pendingAction;
    const identityVerified =
      !!input.identityVerifiedToken &&
      input.identityVerifiedToken === pa.token;
    const exec = await deps.app.executeAction({
      contractVersion: BRIDGE_RPC_VERSION,
      handle: input.handle,
      conversationId: input.conversationId,
      idempotencyKey: pa.token,
      alias: pa.alias,
      input: pa.args,
      flags: { confirmed: true, identityVerified },
    });
    if (exec.contractVersion !== BRIDGE_RPC_VERSION) {
      return { reply: FALLBACK, turnsUsed: 0 };
    }
    if (!exec.ok) {
      // needs_identity / needs_confirmation: preserva pendingAction (não limpa o estado)
      if (exec.error === 'needs_identity' || exec.error === 'needs_confirmation') {
        const ask =
          exec.error === 'needs_identity'
            ? 'preciso confirmar sua identidade'
            : 'você confirma esta ação';
        return {
          reply: `Para prosseguir, ${ask}. Posso seguir?`,
          turnsUsed: 1,
          pendingAction: pa,
        };
      }
      return {
        reply: errorReply(exec.error),
        turnsUsed: 1,
        escalated: exec.error === 'escalate_human',
        escalationReason: exec.error === 'escalate_human' ? 'action_escalate_human' : undefined,
      };
    }
    return { reply: 'Pronto, confirmado e executado.', turnsUsed: 1 };
  }

  // ── 1. Catálogo ──────────────────────────────────────────────────────────
  const toolsResp = await deps.app.listTools({
    contractVersion: BRIDGE_RPC_VERSION,
    handle: input.handle,
    conversationId: input.conversationId,
  });
  if (!toolsResp.ok || toolsResp.contractVersion !== BRIDGE_RPC_VERSION)
    return { reply: FALLBACK, turnsUsed: 0 };

  const llmTools: LlmTool[] = toolsResp.catalog.tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.alias,
      description: t.description,
      parameters: t.inputSchemaJson,
    },
  }));

  // ── 2. Prompt COM histórico ──────────────────────────────────────────────
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: personaSystemPrompt(
        input.personaType,
        input.context,
        deps.now,
        input.timezone,
      ),
    },
    ...(input.history ?? []),
    { role: 'user', content: input.userMessage },
  ];

  // ── 3. Loop LLM↔tools ───────────────────────────────────────────────────
  let turnsUsed = 0;
  for (let i = 0; i < maxIterations; i++) {
    turnsUsed = i + 1;
    const completion = await deps.provider.complete(messages, llmTools);

    // Sem tool calls → resposta final
    if (!completion.toolCalls.length) {
      const text = completion.text ?? '';
      return {
        reply: text.trim() ? text : FALLBACK,
        turnsUsed,
      };
    }

    messages.push({
      role: 'assistant',
      content: completion.text ?? '',
      tool_calls: completion.toolCalls,
    });

    for (const call of completion.toolCalls) {
      const alias = call.function.name;
      let args: unknown = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        /* argumento malformado → args vazio */
      }

      const exec = await deps.app.executeAction({
        contractVersion: BRIDGE_RPC_VERSION,
        handle: input.handle,
        conversationId: input.conversationId,
        idempotencyKey: call.id, // key crua (tool_call_id)
        alias,
        input: args,
        flags: { confirmed: false },
      });

      if (exec.contractVersion !== BRIDGE_RPC_VERSION) {
        return { reply: FALLBACK, turnsUsed: 0 };
      }
      if (!exec.ok) {
        if (
          exec.error === 'needs_confirmation' ||
          exec.error === 'needs_identity'
        ) {
          const ask =
            exec.error === 'needs_identity'
              ? 'preciso confirmar sua identidade'
              : 'você confirma esta ação';
          return {
            reply: `Para prosseguir, ${ask}. Posso seguir?`,
            turnsUsed,
            pendingAction: { alias, args, token: newToken() },
          };
        }

        if (exec.error === 'escalate_human')
          return {
            reply: errorReply('escalate_human'),
            turnsUsed,
            escalated: true,
            escalationReason: 'action_escalate_human',
          };

        // Erro estruturado realimentado ao modelo
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({
            error: exec.error,
            level: exec.level,
            message: exec.message,
          }),
        });
        continue;
      }

      // Tool executou com sucesso
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(exec.data),
      });
    }
  }

  return { reply: FALLBACK, turnsUsed };
}
