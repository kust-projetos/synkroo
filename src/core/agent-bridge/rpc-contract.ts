/**
 * W10.2: fonte unica da fronteira RPC do IA bridge.
 *
 * A release de compatibilidade aceita uma request sem campo de versao como
 * v1. O contrato novo sempre envia v2 explicitamente e nunca trata um valor
 * desconhecido como "latest".
 */
import type { RemoteTool as BridgeRemoteTool, ToolCatalog } from './types';

export const LEGACY_BRIDGE_RPC_VERSION = 'v1' as const;
export const BRIDGE_RPC_VERSION = 'v2' as const;
export const SUPPORTED_BRIDGE_RPC_VERSIONS = [
  LEGACY_BRIDGE_RPC_VERSION,
  BRIDGE_RPC_VERSION,
] as const;
export type BridgeRpcVersion = (typeof SUPPORTED_BRIDGE_RPC_VERSIONS)[number];

export type RemoteTool = BridgeRemoteTool;

type VersionedInput = { contractVersion: BridgeRpcVersion };

// B2: correlation id ponta a ponta (app → issueHandle → runTurn → provider).
// Campo ADITIVO e opcional, apenas para telemetria: nunca participa da
// resolução de versão (resolveContractVersion olha só contractVersion), logo
// presença/ausência jamais dispara contract_version_mismatch (fail-closed
// preservado). Calers antigos que não enviam continuam funcionando.

export type WithCorrelation = { correlationId?: string };

export type ListToolsInput = VersionedInput &
  WithCorrelation & {
    handle: string;
    conversationId: string;
  };
export type CompatibleListToolsInput = Omit<ListToolsInput, 'contractVersion'> & {
  contractVersion?: unknown;
};

export type ExecuteInput = VersionedInput &
  WithCorrelation & {
    handle: string;
    conversationId: string;
    idempotencyKey: string;
    alias: string;
    input: unknown;
    flags: { confirmed: boolean; identityVerified?: boolean };
  };
export type CompatibleExecuteInput = Omit<ExecuteInput, 'contractVersion'> & {
  contractVersion?: unknown;
};

export type IssueHandleInput = VersionedInput &
  WithCorrelation & {
    clinicId: string;
    conversationId: string;
    principalRef: string;
    source: 'system' | 'agent_delegated';
    ttlSeconds?: number;
  };
export type CompatibleIssueHandleInput = Omit<IssueHandleInput, 'contractVersion'> & {
  contractVersion?: unknown;
};

export type PingInput = VersionedInput & WithCorrelation;
export type CompatiblePingInput = { contractVersion?: unknown; correlationId?: unknown };

export type DbHealthInput = VersionedInput & WithCorrelation;
export type CompatibleDbHealthInput = { contractVersion?: unknown; correlationId?: unknown };

export type RpcError = {
  ok: false;
  contractVersion: BridgeRpcVersion;
  error: string;
  level?: string;
  message?: string;
};

export type MismatchError = {
  ok: false;
  error: 'contract_version_mismatch';
  contractVersion: typeof BRIDGE_RPC_VERSION;
};

export type ListToolsResult =
  | { ok: true; contractVersion: BridgeRpcVersion; catalog: ToolCatalog }
  | RpcError;

export type ExecuteResult =
  | { ok: true; contractVersion: BridgeRpcVersion; data: unknown }
  | RpcError;

export type IssueHandleResult =
  | {
      contractVersion: BridgeRpcVersion;
      handle: string;
      expiresAt: string;
    }
  | MismatchError;

export type PingResult =
  | {
      ok: true;
      contractVersion: BridgeRpcVersion;
      from: string;
      now: number;
    }
  | MismatchError;

export type DbHealthResult =
  | { ok: true; contractVersion: BridgeRpcVersion }
  | MismatchError;

export interface HandleIssuerBinding {
  issueHandle(input: IssueHandleInput): Promise<IssueHandleResult>;
}

export interface AppBinding {
  ping(input: PingInput): Promise<PingResult>;
  dbHealth(input: DbHealthInput): Promise<DbHealthResult>;
  listTools(input: ListToolsInput): Promise<ListToolsResult>;
  executeAction(input: ExecuteInput): Promise<ExecuteResult>;
}

export function isSupportedVersion(v: unknown): v is BridgeRpcVersion {
  return (
    typeof v === 'string' &&
    (SUPPORTED_BRIDGE_RPC_VERSIONS as readonly string[]).includes(v)
  );
}

/** Resolve the explicit version, or v1 only for a missing field. */
export function resolveContractVersion(input: unknown): BridgeRpcVersion | null {
  if (input === null || typeof input !== 'object') return null;
  const version = (input as { contractVersion?: unknown }).contractVersion;
  if (version === undefined) return LEGACY_BRIDGE_RPC_VERSION;
  return isSupportedVersion(version) ? version : null;
}

export function contractVersionMismatch(): MismatchError {
  return {
    ok: false,
    error: 'contract_version_mismatch',
    contractVersion: BRIDGE_RPC_VERSION,
  };
}

/**
 * Erro tipado de mismatch de versão (classificação por instanceof, nunca por
 * sniffing de texto de mensagem — o texto pode conter conteúdo externo).
 */
export class ContractVersionMismatchError extends Error {
  constructor(source = 'agent-invoker') {
    super(`[${source}] handle issuer contract version mismatch`);
    this.name = 'ContractVersionMismatchError';
  }
}
