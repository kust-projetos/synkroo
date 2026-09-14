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
  usage?: LlmUsage;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Opções por chamada (aditivas — callers antigos com 2 args seguem válidos). */
export interface LlmCallOpts {
  correlationId?: string;
}

export interface LlmProvider {
  complete(
    messages: ChatMessage[],
    tools: LlmTool[],
    opts?: LlmCallOpts,
  ): Promise<LlmCompletion>;
}

/** Métrica por tentativa de provider call (B2 — log estruturado, sem backend externo). */
export interface LlmCallMetric {
  provider: string;
  model: string;
  latencyMs: number;
  success: boolean;
  /** Tentativa 1-based (1 = primeira; >1 indica retry). */
  attempt: number;
  usage?: LlmUsage;
  correlationId?: string;
  errorCode?: string;
}

export type LlmMetricSink = (metric: LlmCallMetric) => void;

// RPC types are owned by the bridge contract; the agent only re-exports the
// two DTOs it consumes so there is no second hand-written surface here.
export type RemoteTool = SharedRemoteTool;
export type AppBinding = SharedAppBinding;

export interface PendingAction {
  alias: string;
  args: unknown;
  token: string;
}

export interface RunTurnInput {
  handle: string;
  conversationId: string;
  source: 'system' | 'agent_delegated';
  personaType: PersonaType;
  context: string;
  timezone: string;
  userMessage: string;
  // B2: correlação ponta a ponta (x-request-id) + clínica para telemetria.
  // Aditivos e opcionais: callers antigos seguem válidos.
  correlationId?: string;
  clinicId?: string;
  // history e pendingAction são injetados pela casca a partir do this.state (DO é dono);
  // o caller NÃO os passa. confirmedToken/identityVerifiedToken vêm do caller.
  history?: ChatMessage[];
  pendingAction?: PendingAction;
  confirmedToken?: string;
  identityVerifiedToken?: string;
}

export interface RunTurnResult {
  reply: string;
  turnsUsed: number;
  escalated?: boolean;
  escalationReason?: string;
  pendingAction?: PendingAction;
  // B2: erro estruturado preservado no resultado interno; a `reply` ao
  // usuário continua fallback amigável (nunca vaza código/detalhe).
  errorCode?: string;
}
