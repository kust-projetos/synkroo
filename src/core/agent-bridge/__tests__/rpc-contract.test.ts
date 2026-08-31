import {
  BRIDGE_RPC_VERSION,
  LEGACY_BRIDGE_RPC_VERSION,
  SUPPORTED_BRIDGE_RPC_VERSIONS,
  contractVersionMismatch,
  isSupportedVersion,
  resolveContractVersion,
  type AppBinding,
  type HandleIssuerBinding,
  type IssueHandleInput,
} from '../rpc-contract';

describe('IA bridge RPC contract', () => {
  it('keeps the current and compatible versions explicit', () => {
    expect(BRIDGE_RPC_VERSION).toBe('v2');
    expect(LEGACY_BRIDGE_RPC_VERSION).toBe('v1');
    expect(SUPPORTED_BRIDGE_RPC_VERSIONS).toEqual(['v1', 'v2']);
    expect(isSupportedVersion('v1')).toBe(true);
    expect(isSupportedVersion('v2')).toBe(true);
    expect(isSupportedVersion('v3')).toBe(false);
    expect(isSupportedVersion(undefined)).toBe(false);
  });

  it('treats only a missing field as the explicit legacy v1 request', () => {
    expect(resolveContractVersion({})).toBe(LEGACY_BRIDGE_RPC_VERSION);
    expect(resolveContractVersion({ contractVersion: undefined })).toBe(
      LEGACY_BRIDGE_RPC_VERSION,
    );
    expect(resolveContractVersion({ contractVersion: 'v1' })).toBe('v1');
    expect(resolveContractVersion({ contractVersion: 'v2' })).toBe('v2');
    expect(resolveContractVersion({ contractVersion: 'latest' })).toBeNull();
    expect(resolveContractVersion(null)).toBeNull();
  });

  it('advertises the current version for a rejected request', () => {
    expect(contractVersionMismatch()).toEqual({
      ok: false,
      error: 'contract_version_mismatch',
      contractVersion: BRIDGE_RPC_VERSION,
    });
  });

  it('keeps issuer and executor capabilities as separate typed surfaces', () => {
    const issueInput: IssueHandleInput = {
      contractVersion: BRIDGE_RPC_VERSION,
      clinicId: 'clinic-1',
      conversationId: 'conversation-1',
      principalRef: 'agent',
      source: 'system',
    };
    const issuer: HandleIssuerBinding = {
      issueHandle: async () => ({
        contractVersion: BRIDGE_RPC_VERSION,
        handle: 'opaque',
        expiresAt: '2026-08-29T12:00:00.000Z',
      }),
    };
    const app: AppBinding = {
      ping: async () => ({
        ok: true,
        contractVersion: BRIDGE_RPC_VERSION,
        from: 'ia-bridge',
        now: 0,
      }),
      dbHealth: async () => ({ ok: true, contractVersion: BRIDGE_RPC_VERSION }),
      listTools: async () => ({
        ok: true,
        contractVersion: BRIDGE_RPC_VERSION,
        catalog: { version: 'catalog', tools: [] },
      }),
      executeAction: async () => ({
        ok: true,
        contractVersion: BRIDGE_RPC_VERSION,
        data: null,
      }),
    };

    expect(issueInput.contractVersion).toBe(BRIDGE_RPC_VERSION);
    expect(Object.keys(issuer)).toEqual(['issueHandle']);
    expect(Object.keys(app)).toEqual([
      'ping',
      'dbHealth',
      'listTools',
      'executeAction',
    ]);
  });
});
