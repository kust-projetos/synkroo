import { z } from 'zod';
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

function issueFor(input: unknown, over: Record<string, any> = {}) {
  return issueApprovalToken({
    actionName: 'atendimento.enviarMensagem', input,
    clinicId: 'clinic-1', actor: 'agente', source: 'agent_delegated',
    userId: 'u1', onBehalfOf: 'u1', ...over,
  });
}

describe('S5 approval token (server-side, single-use, TTL)', () => {
  beforeEach(() => { logs.length = 0; clearApprovalTokensForTests(); });

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
    const { token } = issueFor(input);
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
    const { token } = issueFor(input);
    const first = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(first.ok).toBe(true);
    const second = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(second).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });

    const t2 = issueFor(input).token;
    const exp = {
      actionName: 'atendimento.enviarMensagem', inputHash: hashActionInput(input),
      clinicId: 'clinic-1', actor: 'agente', source: 'agent_delegated',
      userId: 'u1', onBehalfOf: 'u1',
    };
    expect(consumeApprovalToken(t2, exp)).toMatchObject({ ok: true });
    expect(consumeApprovalToken(t2, exp)).toMatchObject({ ok: false, reason: 'consumed' });
  });

  it('expirado → forbidden', async () => {
    const input = { value: 'hi' };
    const { token } = issueApprovalToken({
      actionName: 'atendimento.enviarMensagem', input,
      clinicId: 'clinic-1', actor: 'agente', source: 'agent_delegated',
      userId: 'u1', onBehalfOf: 'u1',
    }, { ttlMs: -1 });
    const r = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
  });

  it('input distinto (payload-mutation) → forbidden e token NÃO é consumido', async () => {
    const { token } = issueFor({ value: 'hi' });
    const r = await runAction(denyAction, { value: 'bye' }, delegatedCtx({ approvalToken: token }));
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    // token continua válido para o input original (mismatch não consome)
    const retry = await runAction(denyAction, { value: 'hi' }, delegatedCtx({ approvalToken: token }));
    expect(retry.ok).toBe(true);
  });

  it('sem token → forbidden (deny-by-default inalterado)', async () => {
    const r = await runAction(denyAction, { value: 'hi' }, delegatedCtx());
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
  });

  it('token inválido → forbidden', async () => {
    const r = await runAction(denyAction, { value: 'hi' }, delegatedCtx({ approvalToken: 'deadbeef' }));
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
  });

  it('token amarrado a ação/principal: outra ação ou outro actor → forbidden', async () => {
    const input = { value: 'hi' };
    const { token } = issueFor(input);
    const rAction = await runAction(otherDenyAction, input, delegatedCtx({ approvalToken: token }));
    expect(rAction.ok).toBe(false);
    const rActor = await runAction(
      denyAction, input,
      delegatedCtx({ approvalToken: token, audit: { actor: 'agente-outro', onBehalfOf: 'u1' } }),
    );
    expect(rActor.ok).toBe(false);
  });

  it('token amarrado à identidade server-derived: mesmo actor/clínica mas user.id/onBehalfOf distinto → forbidden', async () => {
    const input = { value: 'hi' };
    const { token } = issueFor(input); // emitido para u1/u1
    const r = await runAction(
      denyAction, input,
      delegatedCtx({
        approvalToken: token,
        user: { id: 'u2', email: '', name: '' },
        audit: { actor: 'agente', onBehalfOf: 'u2' },
      }),
    );
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    // mismatch não consome: fluxo legítimo (u1) segue válido
    const retry = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(retry.ok).toBe(true);
  });

  it('mesmo userId mas onBehalfOf distinto → forbidden e token preservado', async () => {
    const input = { value: 'hi' };
    const { token } = issueFor(input); // emitido para u1/u1
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
    const retry = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(retry.ok).toBe(true);
  });

  it('mesmo onBehalfOf mas userId distinto → forbidden e token preservado', async () => {
    const input = { value: 'hi' };
    const { token } = issueFor(input); // emitido para u1/u1
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
    const retry = await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    expect(retry.ok).toBe(true);
  });

  it('humano (user) continua sem token; standard delegada continua sem token', async () => {
    expect((await runAction(denyAction, { value: 'hi' }, userCtx())).ok).toBe(true);
    expect((await runAction(standardAction, { value: 'hi' }, delegatedCtx())).ok).toBe(true);
  });

  it('tokens nunca aparecem em log (só fingerprint)', async () => {
    const input = { value: 'hi' };
    const { token } = issueFor(input);
    await runAction(denyAction, input, delegatedCtx({ approvalToken: token }));
    await runAction(denyAction, input, delegatedCtx({ approvalToken: token })); // replay deny
    await runAction(denyAction, input, delegatedCtx()); // sem token
    const dump = JSON.stringify(logs);
    expect(dump).not.toContain(token);
    expect(logs[0].approvalId).toBe(fingerprintApprovalToken(token));
  });
});
