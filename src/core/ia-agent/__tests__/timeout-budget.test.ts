import { createZenProvider, ZEN_CALL_TIMEOUT_MS } from '../provider-zen';
import { TURN_BUDGET_MS } from '../orchestrator-logic';
import { INVOKER_RPC_TIMEOUT_MS } from '@/core/ia-channel/agent-invoker';

/**
 * B1 (timeout budget) — gate (c): o pior caso do provider (1 call + 1 retry)
 * cabe no budget do turno, que cabe no RPC total do invoker, que fica abaixo
 * do cancel do workerd (~30s). NÃO aumentar o invoker.
 */
describe('B1 timeout budget', () => {
  it('2 × provider call < turn < invoker < workerd', () => {
    expect(2 * ZEN_CALL_TIMEOUT_MS).toBeLessThan(TURN_BUDGET_MS);
    expect(TURN_BUDGET_MS).toBeLessThan(INVOKER_RPC_TIMEOUT_MS);
    expect(INVOKER_RPC_TIMEOUT_MS).toBeLessThan(30_000);
  });

  it('provider usa ZEN_CALL_TIMEOUT_MS como default', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const f = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
    });
    const p = createZenProvider({
      apiKey: 'k',
      model: 'm',
      baseUrl: 'https://x/v1',
      fetchImpl: f as unknown as typeof fetch,
    });
    await p.complete([{ role: 'user', content: 'oi' }], []);
    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      ZEN_CALL_TIMEOUT_MS,
    );
    setTimeoutSpy.mockRestore();
  });
});
