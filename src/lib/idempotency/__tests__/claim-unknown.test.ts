/**
 * Unit tests — claim `unknown` (E4 / HIGH-1).
 *
 * O estado `unknown` é TERMINAL: o efeito pode ter sido despachado e a entrega
 * não foi confirmada. Diferente de `failed`, cujo TTL libera retry legítimo,
 * um claim `unknown` NUNCA é reclaimable — nem depois do TTL de 600s. Sem
 * migração de schema: `status` é `text` livre.
 *
 * Fake DB duck-typed sobre o builder do Drizzle (mesmo padrão de
 * `idempotency.test.ts`): as assertions verificam o desfecho do claim e que
 * NENHUM UPDATE de reclaim é emitido para o estado terminal.
 */

const state: {
  row: { status: string; expiresAt: Date | null } | null;
  updateCalls: Array<Record<string, unknown>>;
} = { row: null, updateCalls: [] };

const applySet = (values: Record<string, unknown>): FakeDb => {
  state.updateCalls.push(values);
  if (state.row) state.row = { ...state.row, ...(values as { status?: string }) };
  return chain;
};

const chain: FakeDb = {
  select: jest.fn(() => chain),
  from: jest.fn(() => chain),
  where: jest.fn(() => chain),
  limit: jest.fn(async () => (state.row ? [state.row] : [])),
  insert: jest.fn(() => chain),
  values: jest.fn(() => chain),
  update: jest.fn(() => chain),
  set: jest.fn(applySet),
  onConflictDoNothing: jest.fn(() => chain),
  returning: jest.fn(async () => []),
};

jest.mock('@/lib/db/client', () => ({ getDb: () => chain }));
jest.mock('@/lib/logger', () => ({
  dbLogger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import {
  claimIdempotencyKey,
  markIdempotencyKeyCompleted,
  markIdempotencyKeyDispatching,
  markIdempotencyKeyFailed,
  markIdempotencyKeyUnknown,
  IDEMPOTENCY_DISPATCHING_REASON,
  IDEMPOTENCY_UNKNOWN_REASON,
} from '@/lib/idempotency';

/** Shape of the Drizzle builder the idempotency helper uses (duck-typed). */
interface FakeDb {
  select: jest.Mock;
  from: jest.Mock;
  where: jest.Mock;
  limit: jest.Mock<Promise<Array<{ status: string; expiresAt: Date | null }>>, []>;
  insert: jest.Mock;
  values: jest.Mock;
  update: jest.Mock;
  set: jest.Mock;
  onConflictDoNothing: jest.Mock;
  returning: jest.Mock;
}

const TTL_SECONDS = 600; // OUTBOUND_IDEMPOTENCY_TTL_SECONDS — o TTL do blocker.

describe('claim idempotency — estado terminal unknown (E4/HIGH-1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state.row = null;
    state.updateCalls = [];
  });

  it('claim unknown NÃO é reclaimable depois do TTL (600s) — nem tenta UPDATE', async () => {
    const expired = new Date(Date.now() - TTL_SECONDS * 1000 - 1);
    state.row = { status: 'unknown', expiresAt: expired };

    const outcome = await claimIdempotencyKey('whatsapp:send:c1:m1', 'whatsapp:outbound', {
      ttlSeconds: TTL_SECONDS,
      completedTtlMs: 600_000,
    });

    expect(outcome).toBe('unknown');
    // Nenhum reclaim: um UPDATE aqui significaria re-dispatch da mesma chave.
    expect(chain.update).not.toHaveBeenCalled();
    expect(state.updateCalls).toEqual([]);
  });

  it('claim unknown continua terminal mesmo SEM TTL configurado', async () => {
    state.row = { status: 'unknown', expiresAt: new Date(Date.now() - 60_000) };

    await expect(
      claimIdempotencyKey('whatsapp:send:c1:m2', 'whatsapp:outbound', { ttlSeconds: TTL_SECONDS }),
    ).resolves.toBe('unknown');
    expect(chain.update).not.toHaveBeenCalled();
  });

  it('claim failed expirado AINDA permite reclaim (regressão: retry legítimo preservado)', async () => {
    state.row = { status: 'failed', expiresAt: new Date(Date.now() - TTL_SECONDS * 1000 - 1) };
    (chain.returning as jest.Mock).mockResolvedValueOnce([{ key: 'whatsapp:send:c1:m3' }]);

    const outcome = await claimIdempotencyKey('whatsapp:send:c1:m3', 'whatsapp:outbound', {
      ttlSeconds: TTL_SECONDS,
    });

    expect(outcome).toBe('claimed');
    expect(chain.update).toHaveBeenCalledTimes(1);
  });

  it('markIdempotencyKeyUnknown persiste status terminal com razão padronizada (sem PII)', async () => {
    state.row = { status: 'in_progress', expiresAt: new Date(Date.now() + TTL_SECONDS * 1000) };

    await markIdempotencyKeyUnknown('whatsapp:send:c1:m4');

    expect(chain.update).toHaveBeenCalledTimes(1);
    expect(state.updateCalls[0]).toEqual({
      status: 'unknown',
      error: IDEMPOTENCY_UNKNOWN_REASON,
      expiresAt: null,
    });
    expect(state.row?.status).toBe('unknown');
  });

  it('markIdempotencyKeyUnknown aceita razão explícita do caller', async () => {
    state.row = { status: 'in_progress', expiresAt: new Date(Date.now() + TTL_SECONDS * 1000) };

    await markIdempotencyKeyUnknown('whatsapp:send:c1:m5', 'sidecar delivery unconfirmed');

    expect(state.updateCalls[0]).toEqual({ status: 'unknown', error: 'sidecar delivery unconfirmed', expiresAt: null });
  });

  it('falha de escrita no marco unknown NÃO propaga (best-effort, como os demais)', async () => {
    state.row = { status: 'in_progress', expiresAt: new Date() };
    // `mockImplementationOnce` esgota na 1ª chamada; a implementação base do
    // fake (definida na criação do chain) volta a valer nas cham seguintes.
    (chain.set as jest.Mock).mockImplementationOnce(() => {
      throw new Error('db offline');
    });

    await expect(markIdempotencyKeyUnknown('whatsapp:send:c1:m6')).resolves.toBeUndefined();
    expect(state.row?.status).toBe('in_progress');
  });
});

describe('claim idempotency — marco durável dispatching (E4/HIGH-1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state.row = null;
    state.updateCalls = [];
  });

  it('claim em `dispatching` (liquidação nunca registrada) → unknown, sem reclaim', async () => {
    // Marco pré-dispatch persistido e o processo morreu antes de liquidar:
    // o efeito pode ter ocorrido. Nem o TTL libera reexecução.
    state.row = { status: 'dispatching', expiresAt: null };

    const outcome = await claimIdempotencyKey('whatsapp:send:c1:p1', 'whatsapp:outbound', {
      ttlSeconds: TTL_SECONDS,
    });

    expect(outcome).toBe('unknown');
    expect(chain.update).not.toHaveBeenCalled();
  });

  it('claim em `dispatching` com expires_at no passado → continua unknown', async () => {
    state.row = { status: 'dispatching', expiresAt: new Date(Date.now() - 10 * TTL_SECONDS * 1000) };

    await expect(
      claimIdempotencyKey('whatsapp:send:c1:p2', 'whatsapp:outbound', { ttlSeconds: TTL_SECONDS }),
    ).resolves.toBe('unknown');
    expect(chain.update).not.toHaveBeenCalled();
  });

  it('markIdempotencyKeyDispatching persiste marco não-expirável de forma condicional', async () => {
    state.row = { status: 'in_progress', expiresAt: new Date(Date.now() + TTL_SECONDS * 1000) };
    (chain.returning as jest.Mock).mockResolvedValueOnce([{ key: 'whatsapp:send:c1:p3' }]);

    const armed = await markIdempotencyKeyDispatching('whatsapp:send:c1:p3');

    expect(armed).toBe(true);
    expect(state.updateCalls[0]).toEqual({
      status: 'dispatching',
      error: IDEMPOTENCY_DISPATCHING_REASON,
      expiresAt: null,
    });
    expect(state.row).toMatchObject({ status: 'dispatching', expiresAt: null });
  });

  it('markIdempotencyKeyDispatching sem linha elegível → false (não despachar)', async () => {
    state.row = { status: 'in_progress', expiresAt: new Date(Date.now() + TTL_SECONDS * 1000) };
    // `returning` base do fake devolve [] — condição não casou.

    await expect(markIdempotencyKeyDispatching('whatsapp:send:c1:p4')).resolves.toBe(false);
  });

  it('markIdempotencyKeyDispatching PROPAGA falha de infra (não é best-effort)', async () => {
    state.row = { status: 'in_progress', expiresAt: new Date() };
    (chain.set as jest.Mock).mockImplementationOnce(() => {
      throw new Error('db offline');
    });

    // Diferente dos marcos finais: quem chama PRECISA saber que o marco não
    // existe para não despachar sem garantia terminal.
    await expect(markIdempotencyKeyDispatching('whatsapp:send:c1:p5')).rejects.toThrow('db offline');
  });

  it('failed com TTL explícito recupera a expiração zerada pelo dispatching', async () => {
    state.row = { status: 'dispatching', expiresAt: null };

    await markIdempotencyKeyFailed('whatsapp:send:c1:p6', 'provider down', TTL_SECONDS);

    expect(state.updateCalls[0].status).toBe('failed');
    expect(state.updateCalls[0].expiresAt).toBeInstanceOf(Date);
  });

  it('failed sem TTL preserva expires_at (contrato legado)', async () => {
    const original = new Date(Date.now() + TTL_SECONDS * 1000);
    state.row = { status: 'in_progress', expiresAt: original };

    await markIdempotencyKeyFailed('whatsapp:send:c1:p7', 'provider down');

    expect(state.updateCalls[0]).not.toHaveProperty('expiresAt');
  });

  it('completed com completedTtlMs grava expiração própria (âncora de conteúdo)', async () => {
    state.row = { status: 'dispatching', expiresAt: null };

    await markIdempotencyKeyCompleted('whatsapp:send:c1:p8', 600_000);

    expect(state.updateCalls[0].status).toBe('completed');
    expect(state.updateCalls[0].expiresAt).toBeInstanceOf(Date);
  });

  it('completed sem TTL é permanente (expires_at nulo)', async () => {
    state.row = { status: 'dispatching', expiresAt: null };

    await markIdempotencyKeyCompleted('whatsapp:send:c1:p9');

    expect(state.updateCalls[0]).toEqual({ status: 'completed', expiresAt: null });
  });
});
