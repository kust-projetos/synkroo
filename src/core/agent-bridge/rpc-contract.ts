/**
 * W10.2: Fonte única e versão do contrato RPC IA Bridge
 * Toda request/response inclui contractVersion; mismatch retorna contract_version_mismatch antes de consumir idempotency.
 */
export const BRIDGE_RPC_VERSION = 'v2' as const;
export const SUPPORTED_BRIDGE_RPC_VERSIONS = ['v1', 'v2'] as const;
export type BridgeRpcVersion = typeof SUPPORTED_BRIDGE_RPC_VERSIONS[number];

export interface ListToolsInput {
  contractVersion: BridgeRpcVersion;
  clinicId: string;
  conversationId: string;
}
export interface ListToolsResult {
  contractVersion: BridgeRpcVersion;
  tools: Array<{ name: string; description: string; inputSchema: unknown }>;
}
export interface ExecuteInput {
  contractVersion: BridgeRpcVersion;
  clinicId: string;
  conversationId: string;
  toolName: string;
  toolInput: unknown;
  handle: string;
}
export interface ExecuteResult {
  contractVersion: BridgeRpcVersion;
  ok: boolean;
  data?: unknown;
  error?: string;
}
export interface IssueHandleInput {
  contractVersion: BridgeRpcVersion;
  clinicId: string;
  conversationId: string;
  principalRef: string;
  source: 'system' | 'agent_delegated';
  ttlSeconds?: number;
}
export interface IssueHandleResult {
  contractVersion: BridgeRpcVersion;
  handle: string;
  expiresAt: string;
}
export type MismatchError = { ok: false; error: 'contract_version_mismatch'; contractVersion: BridgeRpcVersion };

export function isSupportedVersion(v: string | undefined): v is BridgeRpcVersion {
  return !!v && (SUPPORTED_BRIDGE_RPC_VERSIONS as readonly string[]).includes(v);
}
