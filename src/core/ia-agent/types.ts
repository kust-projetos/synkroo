import type {
  AppBinding as SharedAppBinding,
  RemoteTool as SharedRemoteTool,
} from '@/core/agent-bridge/rpc-contract';

export type PersonaType = 'vendas' | 'paciente' | 'recepcao' | 'funcionario';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface LlmTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmCompletion {
  text: string | null;
  toolCalls: ToolCall[];
}

export interface LlmProvider {
  complete(
    messages: ChatMessage[],
    tools: LlmTool[],
    opts?: { correlationId?: string; signal?: AbortSignal },
  ): Promise<LlmCompletion>;
}

// RPC types are owned by the bridge contract; the agent only re-exports the
// two DTOs it consumes so there is no second hand-written surface here.
export type RemoteTool = SharedRemoteTool;
export type AppBinding = SharedAppBinding;

export interface PendingAction {
  alias: string;
  args: unknown;
  token: string;
  /**
   * B1-review — dono da pending (userId no chat; identidade do path no
   * WhatsApp). Opcional por compat com estado v2 já persistido; o confirm
   * EXIGE presença e igualdade (fail-closed).
   */
  principalId?: string;
}

/**
 * B1-review HIGH — resultado da reserva condicional no DO storage.
 * `reserved` só vem preenchido quando o valor atual casou com o esperado
 * (token+principal) e foi deletado na mesma transação; `mismatch` indica
 * que havia valor DIFERENTE (não deletado).
 */
export interface ConsumePendingResult {
  reserved: PendingAction | undefined;
  mismatch: boolean;
}

/** Chave esperada pela reserva condicional (do peek já validado). */
export interface PendingConsumeExpected {
  token: string;
  principalId?: string;
}

export interface RunTurnInput {
  handle: string;
  conversationId: string;
  source: 'system' | 'agent_delegated';
  personaType: PersonaType;
  context: string;
  timezone: string;
  userMessage: string;
  // history e pendingAction são injetados pela casca a partir do this.state (DO é dono);
  // o caller NÃO os passa. confirmedToken/identityVerifiedToken vêm do caller.
  history?: ChatMessage[];
  pendingAction?: PendingAction;
  confirmedToken?: string;
  identityVerifiedToken?: string;
  /**
   * B1-review — identidade do chamador do turno (mapeada de `principalRef`
   * no invoker). Exigida igual à da pending no confirm (fail-closed).
   */
  principalId?: string;
  /** B1: rastreio fim-a-fim (x-request-id do route). Opcional, só observabilidade. */
  correlationId?: string;
}

export interface RunTurnResult {
  reply: string;
  turnsUsed: number;
  escalated?: boolean;
  escalationReason?: string;
  pendingAction?: PendingAction;
  /**
   * B1-review — semântica de escrita da pending no DO storage:
   * 'set' (orchestrator criou nova), 'clear' (confirm consumiu),
   * 'keep' (não escreve — preserva a existente). Opcional: ausente = keep.
   * Em 'clear', `clearedToken` identifica a pending que ESTA execução
   * reservou (o shell só apaga se for a mesma — concorrência).
   */
  pendingActionWrite?: 'set' | 'clear' | 'keep';
  clearedToken?: string;
}
