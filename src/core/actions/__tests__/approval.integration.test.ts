/** @jest-environment node */

/**
 * Integration (DB real, isolado via scripts/integration-run.mjs → synkroo_test).
 *
 * E3 — contratos de aprovação e de efeito consequencial contra Postgres:
 *   1. consumo concorrente do mesmo token → 1 vencedor, 1 efeito;
 *   2. replay após "restart" → negado;
 *   3. mismatch por binding (ação/input/actor/clínica/source/userId/onBehalfOf);
 *   4. TTL no limite;
 *   5. tentativa consequencial: started → finalizada, 1 efeito, input sanitizado;
 *   6. DB-down em emissão, consumo, escrita inicial (zero efeitos) e finalização
 *      (→ unknown_effect, sem resend).
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import { eq, like } from 'drizzle-orm';

// Falha injetada por operação (delega ao client real; nada de mock de dados).
type DbFailure = 'none' | 'all' | 'insert' | 'update';
type DbMethod = (...args: unknown[]) => unknown;
let dbFailure: DbFailure = 'none';
jest.mock('@/lib/db/client', () => {
  const actual = jest.requireActual('@/lib/db/client');
  return {
    getDb: () => {
      const real = actual.getDb();
      return new Proxy(real, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);
          if (typeof value === 'function' && (prop === 'insert' || prop === 'update')) {
            return (...args: unknown[]) => {
              if (dbFailure === 'all' || dbFailure === prop) {
                throw new Error(`db down (${String(prop)})`);
              }
              return (value as DbMethod).apply(target, args);
            };
          }
          return typeof value === 'function' ? (value as DbMethod).bind(target) : value;
        },
      });
    },
    setDbConnectionString: (v: string | null) => actual.setDbConnectionString(v),
    resolveConnectionString: () => actual.resolveConnectionString(),
    closeDb: () => actual.closeDb(),
  };
});

import { getDb } from '@/lib/db/client';
import { actionLogs, approvalTokens } from '@/lib/db/schema/audit';
import { runAction } from '@/core/actions/run';
import { defineAction } from '@/core/actions/registry';
import {
  clearApprovalTokensForTests, consumeApprovalToken, hashActionInput, issueApprovalToken,
} from '@/core/actions/approval';
import { ActionError, type ActionContext } from '@/core/actions/types';

const CLINIC_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';
const ACTION_PREFIX = 'core.e3_integration';
const APPROVE_ACTION = `${ACTION_PREFIX}.approve`;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function delegatedCtx(over: Partial<ActionContext> = {}): ActionContext {
  return {
    source: 'agent_delegated', clinicId: CLINIC_ID,
    user: { id: USER_ID, email: '', name: '' }, role: 'agent',
    can: () => true, hasModule: () => true,
    audit: { actor: 'agente', onBehalfOf: USER_ID }, ...over,
  };
}

function userCtx(over: Partial<ActionContext> = {}): ActionContext {
  return {
    source: 'user', clinicId: CLINIC_ID,
    user: { id: USER_ID, email: 'admin@clinicademo.com', name: 'Admin' }, role: 'owner',
    can: () => true, hasModule: () => true,
    audit: { actor: USER_ID }, ...over,
  };
}

let effectCalls = 0;
const consequentialAction = defineAction({
  name: `${ACTION_PREFIX}.send`, module: 'core', requires: 'core:view',
  label: 'E3 integration send', riskClass: 'deny_non_human', consequential: true,
  auditFields: ['channel'] as const,
  input: z.object({
    channel: z.enum(['whatsapp', 'instagram', 'web']),
    externalId: z.string().min(1),
    message: z.string().min(1),
  }),
  handler: async () => {
    effectCalls += 1;
    return { success: true, messageId: `m-${effectCalls}` };
  },
});

const approvalAction = defineAction({
  name: APPROVE_ACTION, module: 'core', requires: 'core:view',
  label: 'E3 integration approve', riskClass: 'approval',
  input: z.object({ value: z.string() }),
  handler: async (i) => ({ echoed: i.value }),
});

const knownFailureAction = defineAction({
  name: `${ACTION_PREFIX}.fail`, module: 'core', requires: 'core:view',
  label: 'E3 integration fail', riskClass: 'deny_non_human', consequential: true,
  auditFields: ['channel'] as const,
  input: z.object({
    channel: z.enum(['whatsapp', 'instagram', 'web']),
    externalId: z.string().min(1),
    message: z.string().min(1),
  }),
  handler: async (): Promise<{ success: boolean; messageId?: string }> => {
    effectCalls += 1;
    // Falha CONHECIDA do provider (channel-service converte em success:false).
    throw new ActionError('internal', 'Falha ao enviar mensagem.');
  },
});

async function issue(input: unknown, over: Record<string, unknown> = {}) {
  return issueApprovalToken({
    actionName: APPROVE_ACTION, input,
    clinicId: CLINIC_ID, actor: 'agente', source: 'agent_delegated',
    userId: USER_ID, onBehalfOf: USER_ID, ...over,
  });
}

function exp(input: unknown, over: Record<string, unknown> = {}) {
  return {
    actionName: APPROVE_ACTION, inputHash: hashActionInput(input),
    clinicId: CLINIC_ID, actor: 'agente', source: 'agent_delegated',
    userId: USER_ID, onBehalfOf: USER_ID, ...over,
  };
}

async function logsFor(actionName: string) {
  return getDb().select().from(actionLogs)
    .where(eq(actionLogs.actionName, actionName))
    .orderBy(actionLogs.createdAt);
}

async function purgeTestRows() {
  await getDb().delete(actionLogs).where(like(actionLogs.actionName, `${ACTION_PREFIX}.%`));
}

describe('E3 — approval tokens + consequencial contra DB real', () => {
  beforeAll(async () => {
    await clearApprovalTokensForTests();
    await purgeTestRows();
  });

  beforeEach(async () => {
    dbFailure = 'none';
    effectCalls = 0;
    await clearApprovalTokensForTests();
    await purgeTestRows();
  });

  afterAll(async () => {
    const { closeDb } = await import('@/lib/db/client');
    await closeDb();
  });

  it('1. duas conexões consomem o MESMO token → 1 vencedor, 1 efeito, replay negado', async () => {
    const input = { value: 'hi' };
    const { token } = await issue(input);
    const [a, b] = await Promise.allSettled([
      consumeApprovalToken(token, exp(input)),
      consumeApprovalToken(token, exp(input)),
    ]);
    const winners = [a, b].filter(
      (r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ ok: boolean }>).value.ok,
    );
    expect(winners).toHaveLength(1);

    // Replay após "restart" (store persistida; novo consume).
    await expect(consumeApprovalToken(token, exp(input)))
      .resolves.toMatchObject({ ok: false, reason: 'consumed' });

    // Pelo runAction: 1ª execução ok, replay forbidden (sem 2º efeito).
    const { token: t2 } = await issue(input);
    const first = await runAction(approvalAction, input, delegatedCtx({ approvalToken: t2 }));
    expect(first.ok).toBe(true);
    const second = await runAction(approvalAction, input, delegatedCtx({ approvalToken: t2 }));
    expect(second).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
  });

  it('2. mismatch por binding (ação/input/clínica/actor/source/userId/onBehalfOf) não consome', async () => {
    const input = { value: 'hi' };
    const variants: Array<Record<string, unknown>> = [
      { actionName: `${ACTION_PREFIX}.send` },
      { clinicId: '00000000-0000-0000-0000-0000000000ff' },
      { actor: 'outro' },
      { source: 'system' },
      { userId: '00000000-0000-4000-8000-0000000000ff' },
      { onBehalfOf: '00000000-0000-4000-8000-0000000000ff' },
    ];
    for (const variant of variants) {
      const { token } = await issue(input);
      await expect(consumeApprovalToken(token, exp(input, variant)))
        .resolves.toMatchObject({ ok: false, reason: 'mismatch' });
      // Token preservado: consumo correto ainda funciona.
      await expect(consumeApprovalToken(token, exp(input)))
        .resolves.toMatchObject({ ok: true });
    }
    // Input distinto (payload-mutation) também é mismatch.
    const { token: tInput } = await issue(input);
    await expect(consumeApprovalToken(tInput, exp({ value: 'bye' })))
      .resolves.toMatchObject({ ok: false, reason: 'mismatch' });
    await expect(consumeApprovalToken(tInput, exp(input)))
      .resolves.toMatchObject({ ok: true });
  });

  it('3. TTL no limite (agora === expiresAt) → expired, sem marcar consumed_at', async () => {
    const input = { value: 'hi' };
    const { token } = await issue(input);
    const now = new Date();
    await getDb().update(approvalTokens)
      .set({ expiresAt: now })
      .where(eq(approvalTokens.tokenHash, tokenHash(token)));
    await expect(consumeApprovalToken(token, exp(input), { now: now.getTime() }))
      .resolves.toMatchObject({ ok: false, reason: 'expired' });
    const rows = await getDb().select().from(approvalTokens)
      .where(eq(approvalTokens.tokenHash, tokenHash(token)));
    expect(rows).toHaveLength(0); // lazy purge — a tabela não acumula expirados
  });

  it('4. tentativa consequencial: started ANTES do efeito, finalizada ok, 1 efeito, input sanitizado', async () => {
    const r = await runAction(
      consequentialAction,
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      userCtx(),
    );
    expect(r).toEqual({ ok: true, data: { success: true, messageId: 'm-1' } });
    expect(effectCalls).toBe(1);

    const rows = await logsFor(`${ACTION_PREFIX}.send`);
    expect(rows).toHaveLength(1);
    expect(rows[0].result).toBe('ok');
    expect(rows[0].decision).toBe('allow');
    // Sanitização: só o canal allowlisted; telefone/mensagem nunca persistem.
    expect(rows[0].inputRedacted).toEqual({ channel: 'whatsapp' });
    const dump = JSON.stringify(rows[0]);
    expect(dump).not.toContain('5511999990000');
    expect(dump).not.toContain('Olá!');
  });

  it('5. DB-down na EMISSÃO → issue lança; no CONSUMO → forbidden e zero efeito', async () => {
    dbFailure = 'insert';
    await expect(issue({ value: 'hi' })).rejects.toThrow('approval store unavailable');

    dbFailure = 'none';
    const { token } = await issue({ value: 'hi' });
    dbFailure = 'all'; // qualquer escrita do consumo falha
    const r = await runAction(approvalAction, { value: 'hi' }, delegatedCtx({ approvalToken: token }));
    expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
  });

  it('6. DB-down na escrita INICIAL da tentativa → fail-closed (zero efeito)', async () => {
    dbFailure = 'insert';
    const r = await runAction(
      consequentialAction,
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      userCtx(),
    );
    dbFailure = 'none';
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('audit_incomplete');
    expect(effectCalls).toBe(0);
    const rows = await logsFor(`${ACTION_PREFIX}.send`);
    expect(rows).toHaveLength(0);
  });

  it('7. DB-down na FINALIZAÇÃO após o efeito → unknown_effect, tentativa started, sem resend', async () => {
    // Caminho feliz primeiro (finalização ok) — sanity do cenário.
    const ok = await runAction(
      consequentialAction,
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      userCtx(),
    );
    expect(ok.ok).toBe(true);

    // Segunda execução com o UPDATE de finalização derrubado.
    dbFailure = 'update';
    const r = await runAction(
      consequentialAction,
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      userCtx(),
    );
    dbFailure = 'none';
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('unknown_effect');
      expect(typeof r.error.attemptId).toBe('string');
    }
    // Um efeito por execução — nenhum retry automático.
    expect(effectCalls).toBe(2);

    // A tentativa órfã permanece 'started' (reconciliação manual, nunca resend).
    const attemptId = (r as { error: { attemptId: string } }).error.attemptId;
    const rows = await getDb().select().from(actionLogs).where(eq(actionLogs.id, attemptId));
    expect(rows).toHaveLength(1);
    expect(rows[0].result).toBe('started');
    expect(rows[0].inputRedacted).toEqual({ channel: 'whatsapp' });
  });

  it('8. falha CONHECIDA do provider → erro registrado com mensagem segura', async () => {
    const r = await runAction(
      knownFailureAction,
      { channel: 'whatsapp', externalId: '5511999990000', message: 'Olá!' },
      userCtx(),
    );
    expect(r).toEqual({ ok: false, error: { code: 'internal', message: 'Falha ao enviar mensagem.' } });
    expect(effectCalls).toBe(1);
    const rows = await logsFor(`${ACTION_PREFIX}.fail`);
    expect(rows).toHaveLength(1);
    expect(rows[0].result).toBe('error');
    expect(rows[0].errorCode).toBe('internal');
    const dump = JSON.stringify(rows[0]);
    expect(dump).not.toContain('5511999990000');
    expect(dump).not.toContain('Olá!');
  });

  it('9. token nunca aparece em auditoria (só fingerprint 16 hex)', async () => {
    const input = { value: 'hi' };
    const { token } = await issue(input);
    await runAction(approvalAction, input, delegatedCtx({ approvalToken: token }));
    const rows = await logsFor(APPROVE_ACTION);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].approvalId).toMatch(/^[0-9a-f]{16}$/);
    expect(rows[0].approvalId).not.toBe(token);
    expect(JSON.stringify(rows)).not.toContain(token);
  });
});
