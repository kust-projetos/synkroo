/**
 * E3 — contrato de auditoria fail-closed para Actions consequenciais.
 *
 * Regra: a tentativa é registrada em `action_logs` ANTES do efeito; falha
 * dessa escrita impede o handler. A MESMA tentativa é finalizada depois.
 * Falha de finalização (ou desfecho ambíguo do provider) devolve estado
 * explícito `unknown_effect` com a referência da tentativa e NUNCA sugerindo
 * retry — reenviar poderia duplicar o efeito externo.
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import { mockDb } from '@/test-utils/db-mock';
import { runAction } from '../run';
import { defineAction } from '../registry';
import { hashActionInput, issueApprovalToken } from '../approval';
import { ActionError, type ActionContext } from '../types';

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

function ctx(over: Partial<ActionContext> = {}): ActionContext {
  return {
    source: 'user', clinicId: 'clinic-1',
    user: { id: 'u1', email: 'a@b.c', name: 'A' }, role: 'owner',
    can: () => true, hasModule: () => true,
    audit: { actor: 'u1' }, ...over,
  };
}

function delegatedCtx(over: Partial<ActionContext> = {}): ActionContext {
  return {
    source: 'agent_delegated', clinicId: 'clinic-1',
    user: { id: 'u1', email: '', name: '' }, role: 'agent',
    can: () => true, hasModule: () => true,
    audit: { actor: 'agente', onBehalfOf: 'u1' }, ...over,
  };
}

/** Ação consequencial de envio — espelha o contrato de enviar-mensagem-direta. */
let effectCalls = 0;
let attemptsAtEffectTime = -1;
let failWithKnownSendError = false;
let failWithAmbiguousTimeout = false;
const sendHandler = jest.fn(async () => {
  attemptsAtEffectTime = attempts.length;
  effectCalls += 1;
  if (failWithKnownSendError) {
    // Falha CONHECIDA do provider (channel-service converte em success:false).
    throw new ActionError('internal', 'Falha ao enviar mensagem.');
  }
  if (failWithAmbiguousTimeout) {
    // Timeout ambíguo: o envio pode ter ocorrido — nunca "seguro reenviar".
    throw new ActionError('unknown_effect', 'Resultado não confirmado; verifique antes de reenviar.');
  }
  return { success: true, messageId: 'm-1' };
});

const sendAction = defineAction({
  name: 'atendimento.enviarMensagemDireta', module: 'atendimento', requires: 'atendimento:manage_messages',
  label: 'Enviar mensagem direta', riskClass: 'deny_non_human', consequential: true,
  auditFields: ['channel'] as const,
  input: z.object({
    channel: z.enum(['whatsapp', 'instagram', 'web']),
    externalId: z.string().min(1),
    message: z.string().min(1),
  }),
  handler: sendHandler,
});

/** Ação consequencial de classe APPROVAL explícita (contrato APPROVAL exercitável). */
const approvalConsequentialHandler = jest.fn(async (i: { value: string }) => ({ echoed: i.value }));
const approvalConsequentialAction = defineAction({
  name: 'atendimento.enviarMensagem', module: 'atendimento', requires: 'atendimento:manage_messages',
  label: 'Enviar mensagem (APPROVAL)', riskClass: 'approval', consequential: true,
  input: z.object({ value: z.string() }),
  handler: approvalConsequentialHandler,
});

/** Não consequencial: dado com `success:false` continua sendo dado normal. */
const queryAction = defineAction({
  name: 'core.query', module: 'core', requires: 'core:echo', label: 'Query',
  input: z.object({ id: z.string() }),
  handler: async () => ({ success: false, data: null }),
});

function tokenHashOf(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function mockSelectOnce(rows: unknown[]) {
  (mockDb.select as jest.Mock).mockReturnValueOnce({
    from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve(rows)) })),
  });
}

function mockUpdateOnce(rows: unknown[]) {
  (mockDb.update as jest.Mock).mockReturnValueOnce({
    set: jest.fn(() => ({
      where: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve(rows)) })),
    })),
  });
}

function scriptConsumeOk(token: string, input: unknown, actionName = 'atendimento.enviarMensagem') {
  mockSelectOnce([{
    tokenHash: tokenHashOf(token), action: actionName, inputHash: hashActionInput(input),
    clinicId: 'clinic-1', actor: 'agente', source: 'agent_delegated',
    userId: 'u1', onBehalfOf: 'u1',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), consumedAt: null,
  }]);
  mockUpdateOnce([{ tokenHash: tokenHashOf(token) }]);
}

beforeEach(() => {
  jest.clearAllMocks();
  logs.length = 0;
  attempts.length = 0;
  attemptSeq = 0;
  failBeginAttempt = false;
  failFinalizeAttempt = false;
  effectCalls = 0;
  attemptsAtEffectTime = -1;
  failWithKnownSendError = false;
  failWithAmbiguousTimeout = false;
});

describe('E3 — tentativa consequencial: registro ANTES do efeito', () => {
  it('grava a tentativa antes do handler e finaliza a MESMA linha com ok', async () => {
    const r = await runAction(
      sendAction,
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      ctx(),
    );
    expect(r).toEqual({ ok: true, data: { success: true, messageId: 'm-1' } });
    // Ordem: a tentativa já existia quando o efeito rodou.
    expect(attemptsAtEffectTime).toBe(1);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ result: 'ok', decision: 'allow', actionName: 'atendimento.enviarMensagemDireta' });
    expect(effectCalls).toBe(1);
    // Caminho consequencial não escreve log best-effort adicional.
    expect(logs).toHaveLength(0);
  });

  it('falha da escrita inicial → fail-closed: handler NÃO executa (zero efeito)', async () => {
    failBeginAttempt = true;
    const r = await runAction(
      sendAction,
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      ctx(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('audit_incomplete');
      expect(r.error.message).toBe('Auditoria indisponível; ação não executada.');
      expect(r.error.attemptId).toBeUndefined(); // não houve tentativa
    }
    expect(effectCalls).toBe(0);
    expect(attempts).toHaveLength(0);
  });

  it('nunca detecta `success:false` genérico em dado de consulta (sem estado partial)', async () => {
    // Ação não consequencial pode legitimamente devolver { success: false }.
    const r = await runAction(queryAction, { id: 'x' }, ctx());
    expect(r).toEqual({ ok: true, data: { success: false, data: null } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ result: 'ok' });
  });

  it('sanitiza a tentativa: só channel; telefone, mensagem e token nunca entram', async () => {
    const r = await runAction(
      sendAction,
      { channel: 'whatsapp', externalId: '5511999990000', message: 'consulta amanhã', idempotencyKey: 'PII-PROBE-0000' },
      ctx(),
    );
    expect(r.ok).toBe(true);
    const dump = JSON.stringify(attempts);
    expect(attempts[0].inputRedacted).toEqual({ channel: 'whatsapp' });
    expect(dump).not.toContain('5511999990000');
    expect(dump).not.toContain('consulta amanhã');
    expect(dump).not.toContain('PII-PROBE-0000');
  });
});

describe('E3 — falha conhecida do envio vs. finalização de auditoria', () => {
  it('falha CONHECIDA do provider → ok:false + auditoria de erro (mensagem sem detalhe do provider)', async () => {
    failWithKnownSendError = true;
    const r = await runAction(
      sendAction,
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      ctx(),
    );
    expect(r).toEqual({ ok: false, error: { code: 'internal', message: 'Falha ao enviar mensagem.' } });
    expect(attempts[0]).toMatchObject({ result: 'error', errorCode: 'internal' });
    expect(JSON.stringify(r)).not.toContain('provider');
    expect(effectCalls).toBe(1);
  });

  it('timeout ambíguo do provider → unknown_effect (nunca "seguro reenviar")', async () => {
    failWithAmbiguousTimeout = true;
    const r = await runAction(
      sendAction,
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      ctx(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('unknown_effect');
      expect(r.error.message).toContain('verifique antes de reenviar');
    }
    // Auditoria registrou a tentativa como erro, mas deu erro de HANDLER.
    expect(attempts[0]).toMatchObject({ result: 'error', errorCode: 'unknown_effect' });
    expect(effectCalls).toBe(1);
  });

  it('finalização falha DEPOIS do efeito → unknown_effect com attemptId e SEM retry', async () => {
    failFinalizeAttempt = true;
    const r = await runAction(
      sendAction,
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      ctx(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('unknown_effect');
      expect(typeof r.error.attemptId).toBe('string');
      expect(r.error.attemptId).toBe('attempt-1');
    }
    // Um único efeito: nenhum retry automático (risco de duplicate-send).
    expect(effectCalls).toBe(1);
    // A tentativa continua 'started' — sonda visível para reconciliação.
    expect(attempts[0]).toMatchObject({ result: 'started', decision: 'allow' });
  });

  it('handler erro + finalização falha → unknown_effect (separado do erro do handler)', async () => {
    failWithKnownSendError = true;
    failFinalizeAttempt = true;
    const r = await runAction(
      sendAction,
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      ctx(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('unknown_effect');
      expect(typeof r.error.attemptId).toBe('string');
    }
    expect(effectCalls).toBe(1);
    // A tentativa continua 'started' — nada foi finalizado (erro de auditoria).
    expect(attempts[0]).toMatchObject({ result: 'started' });
    expect(Object.keys(attempts[0])).not.toContain('errorCode');
  });
});

describe('E3 — APPROVAL explícita: tentativa antes do consumo, consumo antes do efeito', () => {
  it('token válido → tentativa iniciada antes do consumo e finalizada com ok', async () => {
    const input = { value: 'hi' };
    const { token } = await issueApprovalToken({
      actionName: 'atendimento.enviarMensagem', input,
      clinicId: 'clinic-1', actor: 'agente', source: 'agent_delegated',
      userId: 'u1', onBehalfOf: 'u1',
    });
    scriptConsumeOk(token, input);
    const r = await runAction(
      approvalConsequentialAction, input, delegatedCtx({ approvalToken: token }),
    );
    expect(r).toEqual({ ok: true, data: { echoed: 'hi' } });
    expect(approvalConsequentialHandler).toHaveBeenCalledTimes(1);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ result: 'ok', decision: 'approval_required' });
  });

  it('falha da escrita inicial NÃO consome o token (aprovação preservada, zero efeito)', async () => {
    const input = { value: 'hi' };
    const { token } = await issueApprovalToken({
      actionName: 'atendimento.enviarMensagem', input,
      clinicId: 'clinic-1', actor: 'agente', source: 'agent_delegated',
      userId: 'u1', onBehalfOf: 'u1',
    });
    failBeginAttempt = true;
    const r = await runAction(
      approvalConsequentialAction, input, delegatedCtx({ approvalToken: token }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('audit_incomplete');
    // Zero consumo (nem select, nem update em approval_tokens).
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(approvalConsequentialHandler).not.toHaveBeenCalled();
  });

  it('finalização falha após o efeito aprovado → unknown_effect com tentativa e token já consumido (sem resend)', async () => {
    const input = { value: 'hi' };
    const { token } = await issueApprovalToken({
      actionName: 'atendimento.enviarMensagem', input,
      clinicId: 'clinic-1', actor: 'agente', source: 'agent_delegated',
      userId: 'u1', onBehalfOf: 'u1',
    });
    scriptConsumeOk(token, input);
    failFinalizeAttempt = true;
    const r = await runAction(
      approvalConsequentialAction, input, delegatedCtx({ approvalToken: token }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('unknown_effect');
      expect(typeof r.error.attemptId).toBe('string');
    }
    // Consumo aconteceu uma única vez; nenhum reenvio/segundo consumo.
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(approvalConsequentialHandler).toHaveBeenCalledTimes(1);
  });

  it('consume falhou → tentativa finalizada como erro e handler não executa', async () => {
    const input = { value: 'hi' };
    const { token } = await issueApprovalToken({
      actionName: 'atendimento.enviarMensagem', input,
      clinicId: 'clinic-1', actor: 'agente', source: 'agent_delegated',
      userId: 'u1', onBehalfOf: 'u1',
    });
    mockSelectOnce([]); // token não encontrado
    const r = await runAction(
      approvalConsequentialAction, input, delegatedCtx({ approvalToken: token }),
    );
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    expect(attempts[0]).toMatchObject({ result: 'error', errorCode: 'forbidden', decision: 'approval_required' });
    expect(approvalConsequentialHandler).not.toHaveBeenCalled();
  });
});
