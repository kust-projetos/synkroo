/**
 * B2 — contrato tolera correlationId opcional sem quebrar versão.
 */
import {
  BRIDGE_RPC_VERSION,
  resolveContractVersion,
  type CompatibleExecuteInput,
  type CompatibleIssueHandleInput,
  type CompatibleListToolsInput,
  type ExecuteInput,
  type IssueHandleInput,
  type ListToolsInput,
} from '../rpc-contract';

describe('B2 — rpc-contract tolera correlationId aditivo', () => {
  it('resolve versão normalmente quando correlationId está presente', () => {
    const issue: IssueHandleInput = {
      contractVersion: BRIDGE_RPC_VERSION,
      correlationId: 'corr-1',
      clinicId: 'c1',
      conversationId: 'conv-1',
      principalRef: 'u1',
      source: 'system',
    };
    const list: ListToolsInput = {
      contractVersion: BRIDGE_RPC_VERSION,
      correlationId: 'corr-1',
      handle: 'H',
      conversationId: 'conv-1',
    };
    const exec: ExecuteInput = {
      contractVersion: BRIDGE_RPC_VERSION,
      correlationId: 'corr-1',
      handle: 'H',
      conversationId: 'conv-1',
      idempotencyKey: 'k',
      alias: 'a',
      input: {},
      flags: { confirmed: false },
    };
    expect(resolveContractVersion(issue)).toBe(BRIDGE_RPC_VERSION);
    expect(resolveContractVersion(list)).toBe(BRIDGE_RPC_VERSION);
    expect(resolveContractVersion(exec)).toBe(BRIDGE_RPC_VERSION);
  });

  it('inputs compatíveis aceitam correlationId sem exigir versão', () => {
    const legacy: CompatibleIssueHandleInput = {
      clinicId: 'c1',
      conversationId: 'conv-1',
      principalRef: 'u1',
      source: 'system',
      correlationId: 'corr-legacy',
    };
    const list: CompatibleListToolsInput = {
      handle: 'H',
      conversationId: 'conv-1',
      correlationId: 'corr-legacy',
    };
    const exec: CompatibleExecuteInput = {
      handle: 'H',
      conversationId: 'conv-1',
      idempotencyKey: 'k',
      alias: 'a',
      input: {},
      flags: { confirmed: false },
      correlationId: 'corr-legacy',
    };
    expect(resolveContractVersion(legacy)).toBe('v1');
    expect(resolveContractVersion(list)).toBe('v1');
    expect(resolveContractVersion(exec)).toBe('v1');
  });

  it('versão desconhecida continua fail-closed mesmo com correlationId', () => {
    expect(
      resolveContractVersion({
        contractVersion: 'v99',
        correlationId: 'corr-1',
      }),
    ).toBeNull();
  });

  it('resolve v2 sem correlationId (callers antigos)', () => {
    expect(resolveContractVersion({ contractVersion: 'v2' })).toBe('v2');
  });
});
