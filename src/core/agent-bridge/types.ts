export type SecurityLevel = 'livre' | 'confirmacao' | 'verificacao_forte' | 'proibido';

export interface RemoteTool {
  name: string; // action.name real (ex.: 'operacional.consultarDisponibilidade')
  alias: string; // provider-safe (ex.: 'operacional__consultarDisponibilidade')
  description: string;
  inputSchemaJson: Record<string, unknown>; // JSON Schema draft-07
  module: string;
  permissions: string[];
}

export interface ToolCatalog {
  version: string; // hash/contador do conjunto de tools
  tools: RemoteTool[];
}

export interface HandlePayload {
  clinicId: string;
  conversationId: string;
  principalRef: string; // userId (delegated) ou identificador do agente (system)
  source: 'system' | 'agent_delegated';
  jti: string; // nonce para anti-replay
  exp: number; // epoch ms
}
