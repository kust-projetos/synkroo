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
  complete(messages: ChatMessage[], tools: LlmTool[]): Promise<LlmCompletion>;
}

export interface RemoteTool {
  name: string;
  alias: string;
  description: string;
  inputSchemaJson: Record<string, unknown>;
  module: string;
  permissions: string[];
}

// Espelha a superfície RPC do ia-bridge (Plano 1 + Task 0).
export interface AppBinding {
  listTools(input: {
    handle: string;
    conversationId: string;
  }): Promise<
    | { ok: true; catalog: { version: string; tools: RemoteTool[] } }
    | { ok: false; error: string }
  >;
  executeAction(input: {
    handle: string;
    conversationId: string;
    idempotencyKey: string;
    alias: string;
    input: unknown;
    flags: { confirmed: boolean; identityVerified?: boolean };
  }): Promise<
    | { ok: true; data: unknown }
    | { ok: false; error: string; level?: string; message?: string }
  >;
}

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
}
