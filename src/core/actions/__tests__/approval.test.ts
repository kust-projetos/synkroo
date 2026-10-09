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

/**
 * E3 — contrato de política:
 * - `deny_non_human` + principal não-humano = DENY ABSOLUTO. Token válido não
 *   eleva: o runAction recusa antes do handler e antes de consumir o token.
 * - `approval` (classe APPROVAL explícita) + principal não-humano exige token.
 *   Nenhuma Action de produção usa essa classe hoje; ela mantém o contrato
 *   APPROVAL exercitável sem afrouxar o DENY.
 */
const approvalHandler = jest.fn(async (i: { value: string }) => ({ echoed: i.value }));
const approvalAction = defineAction({
  name: 'atendimento.enviarMensagem', module: 'atendimento', requires: 'atendimento:manage_messages',
  label: 'Enviar mensagem', riskClass: 'approval',
  input: z.object({ value: z.string() }),
  handler: approvalHandler,
});

const denyHandler = jest.fn(async (i: { value: string }) => ({ echoed: i.value }));
const denyAction = defineAction({
  name: 'atendimento.enviarMensagemDireta', module: 'atendimento', requires: 'atendimento:manage_messages',
  label: 'Enviar mensagem direta', riskClass: 'deny_non_human',
  input: z.object({ value: z.string() }),
  handler: denyHandler,
});

const otherApprovalAction = defineAction({
  name: 'atendimento.obterQRCode', module: 'atendimento', requires: 'atendimento:view',
  label: 'QR', riskClass: 'approval',
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
const attempts: any[] = [];
let failBeginAttempt = false;
let failFinalizeAttempt = false;
let attemptSeq = 0;
jest.mock('../audit-writer', () => ({
  writeActionLog: (r: any) => { logs.push(r); },
  allowlistInput: jest.requireActual('../audit-writer').allowlistInput,
  beginActionAttempt: async (r: any) => {
    if (failBeginAttempt) throw new Error('db down (begin attempt)');
    const attemptId = `attempt-${++attemptSeq}`;
    attempts.push({ attemptId, ...r, result: 'started' });
    return { attemptId };
  },
  finalizeActionAttempt: async (attemptId: string, patch: any) => {
    if (failFinalizeAttempt) throw new Error('db down (finalize attempt)');
    const row = attempts.find((a) => a.attemptId === attemptId);
    if (!row) throw new Error('attempt row not found');
    Object.assign(row, patch);
  },
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
    attempts.length = 0;
    attemptSeq = 0;
    failBeginAttempt = false;
    failFinalizeAttempt = false;
    await clearApprovalTokensForTests();
    jest.clearAllMocks();
  });

  it('exposes conservative defaults (15min TTL, versioned policy)', () => {
    expect(APPROVAL_TTL_MS_DEFAULT).toBe(15 * 60 * 1000);
    expect(APPROVAL_POLICY_VERSION).toBe('s5-approval-v1');
  });

  it('issueApprovalToken: token opaco 32 bytes → 64 chars hex lowercase, únicos (regressão E1)', async () => {
    const { token: t1 } = await issueFor({ value: 'hi' });
    const { token: t2 } = await issueFor({ value: 'hi' });
    expect(t1).toMatch(/^[0-9a-f]{64}$/);
    expect(t2).toMatch(/^[0-9a-f]{64}$/);
    expect(t1).not.toBe(t2);
  });

  it('evaluatePolicy (E3): deny_non_human + não-humano = DENY absoluto (nunca approval_required)', () => {
    // Decisão humana vinculante: negar sempre; token NUNCA eleva.
    expect(evaluatePolicy({ riskClass: 'deny_non_human' }, { source: 'agent_delegated' }).decision)
      .toBe('deny');
    expect(evaluatePolicy({ riskClass: 'deny_non_human' }, { source: 'system' }).decision)
      .toBe('deny');
    // Classe APPROVAL explícita é a ÚNICA origem de approval_required.
    expect(evaluatePolicy({ riskClass: 'approval' }, { source: 'agent_delegated' }).decision)
      .toBe('approval_required');
    expect(evaluatePolicy({ riskClass: 'approval' }, { source: 'system' }).decision)
      .toBe('approval_required');
    // Humano / standard continuam allow.
    expect(evaluatePolicy({ riskClass: 'deny_non_human' }, { source: 'user' }).decision).toBe('allow');
    expect(evaluatePolicy({ riskClass: 'approval' }, { source: 'user' }).decision).toBe('allow');
    expect(evaluatePolicy({}, { source: 'agent_delegated' }).decision).toBe('allow');
  });

  it('approved flow (classe APPROVAL explícita): token válido + input idêntico → ok, com decision + approvalId fingerprint', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    scriptConsumeOk(token, input);
    const r = await runAction(approvalAction, input, delegatedCtx({ approvalToken: token }));
    expect(r).toEqual({ ok: true, data: { echoed: 'hi' } });
    expect(approvalHandler).toHaveBeenCalledTimes(1);
    const last = logs[logs.length - 1];
    expect(last).toMatchObject({
      result: 'ok', decision: 'approval_required',
      policyVersion: APPROVAL_POLICY_VERSION,
      approvalId: fingerprintApprovalToken(token),
    });
    expect(typeof last.durationMs).toBe('number');
  });

  // ── DENY ABSOLUTO (E3) — token nunca eleva ───────────────────────────────

  it('DENY + token válido e perfeitamente amarrado → forbidden, ZERO handler e ZERO consume', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    // Nenhum consumo é roteirizado: qualquer select/update já é violação.
    const r = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    // Handler nunca chamado e consumo nunca tentado (nem select, nem update).
    expect(denyHandler).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
    const last = logs[logs.length - 1];
    expect(last).toMatchObject({ result: 'error', errorCode: 'forbidden', decision: 'deny' });
    expect(last.inputRedacted).toEqual({});
    // Token preservado para o binding legítimo (nada foi consumido).
    scriptConsumeOk(token, input);
    const retry = await runAction(approvalAction, input, delegatedCtx({ approvalToken: token }));
    expect(retry.ok).toBe(true);
  });

  it('DENY não sobrepõe RBAC: token válido + can()=false → forbidden sem consume (negação mais restritiva vence)', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    const r = await runAction(
      denyAction, input, delegatedCtx({ approvalToken: token, can: () => false }),
    );
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    expect(denyHandler).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('DENY não sobrepõe módulo: token válido + hasModule()=false → module_disabled sem consume', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    const r = await runAction(
      denyAction, input, delegatedCtx({ approvalToken: token, hasModule: () => false }),
    );
    expect(r).toEqual({ ok: false, error: { code: 'module_disabled', message: expect.any(String) } });
    expect(denyHandler).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('DENY permanece para source=system (não só agent_delegated)', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    const r = await runAction(
      denyAction, input,
      { source: 'system', clinicId: 'clinic-1', can: () => true, hasModule: () => true, audit: { actor: 'agente (sistema)' }, approvalToken: token },
    );
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    expect(denyHandler).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('humano (user) em deny_non_human continua sem token (regra de produto inalterada)', async () => {
    const r = await runAction(denyAction, { value: 'hi' }, userCtx());
    expect(r).toEqual({ ok: true, data: { echoed: 'hi' } });
    expect(denyHandler).toHaveBeenCalledTimes(1);
  });

  it('replay/consumo duplo → forbidden (unit + runAction)', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    scriptConsumeOk(token, input);
    const first = await runAction(approvalAction, input, delegatedCtx({ approvalToken: token }));
    expect(first.ok).toBe(true);
    // Segunda leitura encontra a linha já consumida → forbidden.
    mockSelectOnce([dbRowFor(token, input, { consumedAt: new Date() })]);
    const second = await runAction(approvalAction, input, delegatedCtx({ approvalToken: token }));
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
    const r = await runAction(approvalAction, input, delegatedCtx({ approvalToken: token }));
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    expect(mockDb.update).not.toHaveBeenCalled();
    // Pós-purge a linha sumiu → not_found (tabela não acumula expirados).
    mockSelectOnce([]);
    expect(await consumeApprovalToken(token, expFor(input)))
      .toMatchObject({ ok: false, reason: 'not_found' });
  });

  it('TTL no limite (agora === expiresAt) → expired, sem consumo', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    const now = Date.now();
    mockSelectOnce([dbRowFor(token, input, { expiresAt: new Date(now) })]);
    expect(await consumeApprovalToken(token, expFor(input), { now }))
      .toMatchObject({ ok: false, reason: 'expired' });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('input distinto (payload-mutation) → forbidden e token NÃO é consumido', async () => {
    const { token } = await issueFor({ value: 'hi' });
    mockSelectOnce([dbRowFor(token, { value: 'hi' })]);
    const r = await runAction(approvalAction, { value: 'bye' }, delegatedCtx({ approvalToken: token }));
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    expect(mockDb.update).not.toHaveBeenCalled();
    // token continua válido para o input original (mismatch não consome)
    scriptConsumeOk(token, { value: 'hi' });
    const retry = await runAction(approvalAction, { value: 'hi' }, delegatedCtx({ approvalToken: token }));
    expect(retry.ok).toBe(true);
  });

  it('binding amarra o input CANÔNICO pós-Zod (campo extra stripado não quebra o hash)', async () => {
    const { token } = await issueFor({ value: 'hi' });
    scriptConsumeOk(token, { value: 'hi' });
    // `extra` é removido pelo Zod: o hash canônico é o de {value:'hi'}.
    const r = await runAction(
      approvalAction, { value: 'hi', extra: 'x' }, delegatedCtx({ approvalToken: token }),
    );
    expect(r).toEqual({ ok: true, data: { echoed: 'hi' } });
    // E o inverso é fail-closed: token emitido para um input NÃO canônico
    // (com campo extra) não casa com o hash canônico do consumo → mismatch.
    const { token: t2 } = await issueFor({ value: 'hi', extra: 'x' });
    mockSelectOnce([dbRowFor(t2, { value: 'hi', extra: 'x' })]);
    const updateCallsBefore = (mockDb.update as jest.Mock).mock.calls.length;
    const r2 = await runAction(approvalAction, { value: 'hi' }, delegatedCtx({ approvalToken: t2 }));
    expect(r2).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    expect((mockDb.update as jest.Mock).mock.calls.length).toBe(updateCallsBefore);
  });

  it('sem token → forbidden (deny-by-default inalterado)', async () => {
    const r = await runAction(approvalAction, { value: 'hi' }, delegatedCtx());
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
  });

  it('token inválido → forbidden', async () => {
    mockSelectOnce([]);
    const r = await runAction(approvalAction, { value: 'hi' }, delegatedCtx({ approvalToken: 'deadbeef' }));
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
  });

  it('token amarrado a ação: outra action → forbidden sem consumo', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    mockSelectOnce([dbRowFor(token, input)]);
    const rAction = await runAction(otherApprovalAction, input, delegatedCtx({ approvalToken: token }));
    expect(rAction.ok).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('token amarrado ao actor: outro actor → forbidden sem consumo', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    mockSelectOnce([dbRowFor(token, input)]);
    const rActor = await runAction(
      approvalAction, input,
      delegatedCtx({ approvalToken: token, audit: { actor: 'agente-outro', onBehalfOf: 'u1' } }),
    );
    expect(rActor.ok).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('token amarrado à clínica/source: outra clínica ou source → forbidden sem consumo', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    mockSelectOnce([dbRowFor(token, input)]);
    const rClinic = await runAction(
      approvalAction, input, delegatedCtx({ approvalToken: token, clinicId: 'clinic-2' }),
    );
    expect(rClinic.ok).toBe(false);
    mockSelectOnce([dbRowFor(token, input)]);
    const rSource = await runAction(
      approvalAction, input, delegatedCtx({ approvalToken: token, source: 'system' }),
    );
    expect(rSource.ok).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('token amarrado à identidade server-derived: mesmo actor/clínica mas user.id/onBehalfOf distinto → forbidden', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input); // emitido para u1/u1
    mockSelectOnce([dbRowFor(token, input)]);
    const r = await runAction(
      approvalAction, input,
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
    const retry = await runAction(approvalAction, input, delegatedCtx({ approvalToken: token }));
    expect(retry.ok).toBe(true);
  });

  it('mesmo userId mas onBehalfOf distinto → forbidden e token preservado', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input); // emitido para u1/u1
    mockSelectOnce([dbRowFor(token, input)]);
    const r = await runAction(
      approvalAction, input,
      delegatedCtx({
        approvalToken: token,
        user: { id: 'u1', email: '', name: '' },
        audit: { actor: 'agente', onBehalfOf: 'u2' },
      }),
    );
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    // mismatch não consome: fluxo legítimo (u1/u1) segue válido
    scriptConsumeOk(token, input);
    const retry = await runAction(approvalAction, input, delegatedCtx({ approvalToken: token }));
    expect(retry.ok).toBe(true);
  });

  it('mesmo onBehalfOf mas userId distinto → forbidden e token preservado', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input); // emitido para u1/u1
    mockSelectOnce([dbRowFor(token, input)]);
    const r = await runAction(
      approvalAction, input,
      delegatedCtx({
        approvalToken: token,
        user: { id: 'u2', email: '', name: '' },
        audit: { actor: 'agente', onBehalfOf: 'u1' },
      }),
    );
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    // mismatch não consome: fluxo legítimo (u1/u1) segue válido
    scriptConsumeOk(token, input);
    const retry = await runAction(approvalAction, input, delegatedCtx({ approvalToken: token }));
    expect(retry.ok).toBe(true);
  });

  it('standard delegada continua sem token', async () => {
    expect((await runAction(standardAction, { value: 'hi' }, delegatedCtx())).ok).toBe(true);
  });

  it('tokens nunca aparecem em log (só fingerprint)', async () => {
    const input = { value: 'hi' };
    const { token } = await issueFor(input);
    scriptConsumeOk(token, input);
    await runAction(approvalAction, input, delegatedCtx({ approvalToken: token }));
    mockSelectOnce([dbRowFor(token, input, { consumedAt: new Date() })]);
    await runAction(approvalAction, input, delegatedCtx({ approvalToken: token })); // replay deny
    await runAction(approvalAction, input, delegatedCtx()); // sem token
    await runAction(denyAction, input, delegatedCtx({ approvalToken: token })); // deny absoluto
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
      approvalAction, { value: 'hi' }, delegatedCtx({ approvalToken: 'sometoken' }),
    );
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
  });
});
