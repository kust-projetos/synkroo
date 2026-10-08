import { createHash } from 'crypto';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { mockDb } from '@/test-utils/db-mock';
import { runAction } from '../run';
import { defineAction } from '../registry';
import type { ActionContext } from '../types';
import {
  clearApprovalTokensForTests, consumeApprovalToken, evaluatePolicy,
  fingerprintApprovalToken, hashActionInput, issueApprovalToken,
  APPROVAL_TTL_MS_DEFAULT, APPROVAL_POLICY_VERSION,
} from '../approval';

const denyAction = defineAction({
  name: 'atendimento.enviarMensagem', module: 'atendimento', requires: 'atendimento:manage_messages',
  label: 'Enviar mensagem', riskClass: 'deny_non_human',
  input: z.object({ value: z.string() }),
  handler: async (i) => ({ echoed: i.value }),
});

const otherDenyAction = defineAction({
  name: 'atendimento.obterQRCode', module: 'atendimento', requires: 'atendimento:view',
  label: 'QR', riskClass: 'deny_non_human',
  input: z.object({ value: z.string() }),
  handler: async () => ({ qrcode: null }),
});

const standardAction = defineAction({
  name: 'core.echo', module: 'core', requires: 'core:echo', label: 'Echo',
  input: z.object({ value: z.string() }),
  handler: async (i) => ({ echoed: i.value }),
});

function delegatedCtx(over: Partial<ActionContext> = {}): ActionContext {
  return {
    source: 'agent_delegated', clinicId: 'clinic-1',
    user: { id: 'u1', email: '', name: '' }, role: 'agent',
    can: () => true, hasModule: () => true,
    audit: { actor: 'agente', onBehalfOf: 'u1' }, ...over,
  };
}

function userCtx(over: Partial<ActionContext> = {}): ActionContext {
  return {
    source: 'user', clinicId: 'clinic-1',
    user: { id: 'u1', email: 'a@b.c', name: 'A' }, role: 'owner',
    can: () => true, hasModule: () => true,
    audit: { actor: 'u1' }, ...over,
  };
}

const logs: any[] = [];
jest.mock('../audit-writer', () => ({
  writeActionLog: (r: any) => { logs.push(r); },
  allowlistInput: jest.requireActual('../audit-writer').allowlistInput,
}));

// ── Helpers do store DB mockado (S5-PERSIST) ──────────────────────────────
// O getDb global é mockado (jest.setup) — cada teste roteiriza as linhas que
// a tabela `approval_tokens` retornaria (select) e o resultado do consumo
// atômico (update ... returning). Insert/delete usam o chain default do mock.

function tokenHashOf(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function dbRowFor(token: string, input: unknown, over: Record<string, any> = {}) {
  return {
    tokenHash: tokenHashOf(token),
    action: 'atendimento.enviarMensagem',
    inputHash: hashActionInput(input),
    clinicId: 'clinic-1', actor: 'agente', source: 'agent_delegated',
    userId: 'u1', onBehalfOf: 'u1',
    expiresAt: new Date(Date.now() + APPROVAL_TTL_MS_DEFAULT),
    consumedAt: null,
    ...over,
  };
}

/** Próximo select() retorna estas linhas (o que a tabela teria). */
function mockSelectOnce(rows: unknown[]) {
  (mockDb.select as jest.Mock).mockReturnValueOnce({
    from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve(rows)) })),
  });
}

/** Próximo update() atômico retorna estas linhas (vazio = corrida perdida). */
function mockUpdateOnce(rows: unknown[]) {
  (mockDb.update as jest.Mock).mockReturnValueOnce({
    set: jest.fn(() => ({
      where: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve(rows)) })),
    })),
  });
}

function expFor(input: unknown, over: Record<string, any> = {}) {
  return {
    actionName: 'atendimento.enviarMensagem', inputHash: hashActionInput(input),
    clinicId: 'clinic-1', actor: 'agente', source: 'agent_delegated',
    userId: 'u1', onBehalfOf: 'u1', ...over,
  };
}

async function issueFor(input: unknown, over: Record<string, any> = {}) {
  return issueApprovalToken({
    actionName: 'atendimento.enviarMensagem', input,
    clinicId: 'clinic-1', actor: 'agente', source: 'agent_delegated',
    userId: 'u1', onBehalfOf: 'u1', ...over,
  });
}

/** Roteiriza um consumo bem-sucedido (select encontra linha + update afeta 1). */
function scriptConsumeOk(token: string, input: unknown) {
  mockSelectOnce([dbRowFor(token, input)]);
  mockUpdateOnce([{ tokenHash: tokenHashOf(token) }]);
}

describe('S5 approval token (server-side, single-use, TTL, DB-backed)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    logs.length = 0;
    await clearApprovalTokensForTests();
    jest.clearAllMocks();
  });

  it('exposes conservative defaults (15min TTL, versioned policy)', () => {
    expect(APPROVAL_TTL_MS_DEFAULT).toBe(15 * 60 * 1000);
    expect(APPROVAL_POLICY_VERSION).toBe('s5-approval-v1');
  });

  it('evaluatePolicy: deny_non_human + non-user → approval_required; user/standard → allow', () => {
    expect(evaluatePolicy({ riskClass: 'deny_non_human' }, { source: 'agent_delegated' }).decision)
      .toBe('approval_required');
    expect(evaluatePolicy({ riskClass: 'deny_non_human' }, { source: 'system' }).decision)
      .toBe('approval_required');
    expect(evaluatePolicy({ riskClass: 'deny_non_human' }, { source: 'user' }).decision).toBe('allow');
    expect(evaluatePolicy({}, { source: 'agent_delegated' }).decision).toBe('allow');
  });

  it('approved flow: token válido + input idêntico → ok, com decision + approvalId fingerprint', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    scriptConsumeOk(token, input);
    const r = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(r).toEqual({ ok: true, data: { echoed: 'hi' } });
    const last = logs[logs.length - 1];
    expect(last).toMatchObject({
      result: 'ok', decision: 'approval_required',
      policyVersion: APPROVAL_POLICY_VERSION,
      approvalId: fingerprintApprovalToken(token),
    });
    expect(typeof last.durationMs).toBe('number');
  });

  it('replay/consumo duplo → forbidden (unit + runAction)', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    scriptConsumeOk(token, input);
    const first = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(first.ok).toBe(true);
    // Segunda leitura encontra a linha já consumida → forbidden.
    mockSelectOnce([dbRowFor(token, input, { consumedAt: new Date() })]);
    const second = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(second).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });

    const t2 = (await issueFor(input)).token;
    const exp = expFor(input);
    scriptConsumeOk(t2, input);
    expect(await consumeApprovalToken(t2, exp)).toMatchObject({ ok: true });
    mockSelectOnce([dbRowFor(t2, input, { consumedAt: new Date() })]);
    expect(await consumeApprovalToken(t2, exp)).toMatchObject({ ok: false, reason: 'consumed' });
  });

  it('corrida entre instâncias: update atômico sem linha → 2º forbidden (consumed)', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    mockSelectOnce([dbRowFor(token, input)]);
    mockUpdateOnce([]); // outra instância comitou primeiro
    expect(await consumeApprovalToken(token, expFor(input)))
      .toMatchObject({ ok: false, reason: 'consumed' });
  });

  it('expirado → forbidden e não acumula (lazy purge)', async () => {
    const input = { value: 'hi' };
    const { token } = await issueApprovalToken({
      actionName: 'atendimento.enviarMensagem', input,
      clinicId: 'clinic-1', actor: 'agente', source: 'agent_delegated',
      userId: 'u1', onBehalfOf: 'u1',
    }, { ttlMs: -1 });
    // Linha ainda presente mas expirada → forbidden, sem UPDATE de consumo.
    mockSelectOnce([dbRowFor(token, input, { expiresAt: new Date(Date.now() - 1000) })]);
    const r = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    expect(mockDb.update).not.toHaveBeenCalled();
    // Pós-purge a linha sumiu → not_found (tabela não acumula expirados).
    mockSelectOnce([]);
    expect(await consumeApprovalToken(token, expFor(input)))
      .toMatchObject({ ok: false, reason: 'not_found' });
  });

  it('input distinto (payload-mutation) → forbidden e token NÃO é consumido', async () => {
    const { token } = await issueFor({ value: 'hi' });
    mockSelectOnce([dbRowFor(token, { value: 'hi' })]);
    const r = await runAction(denyAction, { value: 'bye' }, delegatedCtx({ approvalToken: token }));
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    expect(mockDb.update).not.toHaveBeenCalled();
    // token continua válido para o input original (mismatch não consome)
    scriptConsumeOk(token, { value: 'hi' });
    const retry = await runAction(denyAction, { value: 'hi' }, delegatedCtx({ approvalToken: token }));
    expect(retry.ok).toBe(true);
  });

  it('sem token → forbidden (deny-by-default inalterado)', async () => {
    const r = await runAction(denyAction, { value: 'hi' }, delegatedCtx());
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
  });

  it('token inválido → forbidden', async () => {
    mockSelectOnce([]);
    const r = await runAction(denyAction, { value: 'hi' }, delegatedCtx({ approvalToken: 'deadbeef' }));
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
  });

  it('token amarrado a ação/principal: outra ação ou outro actor → forbidden', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    mockSelectOnce([dbRowFor(token, input)]);
    const rAction = await runAction(otherDenyAction, input, delegatedCtx({ approvalToken: token }));
    expect(rAction.ok).toBe(false);
    mockSelectOnce([dbRowFor(token, input)]);
    const rActor = await runAction(
      denyAction, input,
      delegatedCtx({ approvalToken: token, audit: { actor: 'agente-outro', onBehalfOf: 'u1' } }),
    );
    expect(rActor.ok).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('token amarrado à identidade server-derived: mesmo actor/clínica mas user.id/onBehalfOf distinto → forbidden', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input); // emitido para u1/u1
    mockSelectOnce([dbRowFor(token, input)]);
    const r = await runAction(
      denyAction, input,
      delegatedCtx({
        approvalToken: token,
        user: { id: 'u2', email: '', name: '' },
        audit: { actor: 'agente', onBehalfOf: 'u2' },
      }),
    );
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    expect(mockDb.update).not.toHaveBeenCalled();
    // mismatch não consome: fluxo legítimo (u1) segue válido
    scriptConsumeOk(token, input);
    const retry = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(retry.ok).toBe(true);
  });

  it('mesmo userId mas onBehalfOf distinto → forbidden e token preservado', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input); // emitido para u1/u1
    mockSelectOnce([dbRowFor(token, input)]);
    const r = await runAction(
      denyAction, input,
      delegatedCtx({
        approvalToken: token,
        user: { id: 'u1', email: '', name: '' },
        audit: { actor: 'agente', onBehalfOf: 'u2' },
      }),
    );
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    // mismatch não consome: fluxo legítimo (u1/u1) segue válido
    scriptConsumeOk(token, input);
    const retry = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(retry.ok).toBe(true);
  });

  it('mesmo onBehalfOf mas userId distinto → forbidden e token preservado', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input); // emitido para u1/u1
    mockSelectOnce([dbRowFor(token, input)]);
    const r = await runAction(
      denyAction, input,
      delegatedCtx({
        approvalToken: token,
        user: { id: 'u2', email: '', name: '' },
        audit: { actor: 'agente', onBehalfOf: 'u1' },
      }),
    );
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    // mismatch não consome: fluxo legítimo (u1/u1) segue válido
    scriptConsumeOk(token, input);
    const retry = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(retry.ok).toBe(true);
  });

  it('humano (user) continua sem token; standard delegada continua sem token', async () => {
    expect((await runAction(denyAction, { value: 'hi' }, userCtx())).ok).toBe(true);
    expect((await runAction(standardAction, { value: 'hi' }, delegatedCtx())).ok).toBe(true);
  });

  it('tokens nunca aparecem em log (só fingerprint)', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    scriptConsumeOk(token, input);
    await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    mockSelectOnce([dbRowFor(token, input, { consumedAt: new Date() })]);
    await runAction(denyAction, input, delegatedCtx({ approvalToken: token })); // replay deny
    await runAction(denyAction, input, delegatedCtx()); // sem token
    const dump = JSON.stringify(logs);
    expect(dump).not.toContain(token);
    expect(logs[0].approvalId).toBe(fingerprintApprovalToken(token));
  });

  it('DB indisponível → fail-closed: issue lança, consume nega, runAction forbidden', async () => {
    (getDb as jest.Mock).mockImplementationOnce(() => { throw new Error('db down'); });
    await expect(issueFor({ value: 'hi' })).rejects.toThrow('approval store unavailable');

    (getDb as jest.Mock).mockImplementationOnce(() => { throw new Error('db down'); });
    await expect(consumeApprovalToken('sometoken', expFor({ value: 'hi' })))
      .resolves.toMatchObject({ ok: false });

    // runAction com DB fora: purga falha → consume nega → forbidden (nunca allow).
    (getDb as jest.Mock).mockImplementationOnce(() => { throw new Error('db down'); });
    const r = await runAction(
      denyAction, { value: 'hi' }, delegatedCtx({ approvalToken: 'sometoken' }),
    );
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
  });
});
