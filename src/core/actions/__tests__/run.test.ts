import { z } from 'zod';
import { runAction } from '../run';
import { defineAction } from '../registry';
import { ActionError, type ActionContext } from '../types';

const action = defineAction({
  name: 'core.echo', module: 'core', requires: 'core:echo', label: 'Echo',
  input: z.object({ value: z.string() }),
  handler: async (i) => ({ echoed: i.value }),
});

const allowlistedAction = defineAction({
  name: 'core.allowlisted', module: 'core', requires: 'core:echo', label: 'Allowlisted',
  input: z.object({ eventId: z.string(), metadata: z.record(z.unknown()) }),
  auditFields: ['eventId'],
  handler: async () => ({ ok: true }),
});

function ctx(over: Partial<ActionContext> = {}): ActionContext {
  return {
    source: 'user', clinicId: 'clinic-1',
    user: { id: 'u1', email: 'a@b.c', name: 'A' }, role: 'owner',
    can: () => true, hasModule: () => true,
    audit: { actor: 'u1' }, ...over,
  };
}

// captura as gravações de auditoria
const logs: any[] = [];
jest.mock('../audit-writer', () => ({
  writeActionLog: (r: any) => { logs.push(r); },
  allowlistInput: jest.requireActual('../audit-writer').allowlistInput,
}));

describe('runAction pipeline', () => {
  beforeEach(() => { logs.length = 0; });

  it('rejects when ctx is missing', async () => {
    const r = await runAction(action, { value: 'x' }, undefined as any);
    expect(r).toEqual({ ok: false, error: { code: 'unauthenticated', message: expect.any(String) } });
  });

  it('rejects non-system principal without user', async () => {
    const r = await runAction(action, { value: 'x' }, ctx({ user: undefined }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('unauthenticated');
  });

  it('allows system principal without user', async () => {
    const r = await runAction(action, { value: 'x' },
      ctx({ source: 'system', user: undefined, audit: { actor: 'agente (sistema)' } }));
    expect(r.ok).toBe(true);
  });

  it('rejects when module disabled', async () => {
    const r = await runAction(action, { value: 'x' }, ctx({ hasModule: () => false }));
    if (!r.ok) expect(r.error.code).toBe('module_disabled');
  });

  it('rejects when permission denied', async () => {
    const r = await runAction(action, { value: 'x' }, ctx({ can: () => false }));
    if (!r.ok) expect(r.error.code).toBe('forbidden');
  });

  it('rejects invalid input', async () => {
    const r = await runAction(action, { value: 123 }, ctx());
    if (!r.ok) expect(r.error.code).toBe('invalid_input');
  });

  it('runs handler and returns data', async () => {
    const r = await runAction(action, { value: 'hi' }, ctx());
    expect(r).toEqual({ ok: true, data: { echoed: 'hi' } });
  });

  it('maps ActionError thrown by handler', async () => {
    const boom = defineAction({
      name: 'core.boom', module: 'core', requires: 'core:boom', label: 'Boom',
      input: z.object({}), handler: async () => { throw new ActionError('not_found', 'nope'); },
    });
    const r = await runAction(boom, {}, ctx());
    if (!r.ok) expect(r.error.code).toBe('not_found');
  });

  it('persists only action allowlisted fields', async () => {
    await runAction(allowlistedAction, { eventId: 'evt-1', metadata: { phone: '999' } }, ctx());
    expect(logs[0].inputRedacted).toEqual({ eventId: 'evt-1' });
  });

  it('writes an audit log on success and on error', async () => {
    await runAction(action, { value: 'hi' }, ctx());
    await runAction(action, { value: 1 as any }, ctx());
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ result: 'ok', actionName: 'core.echo', clinicId: 'clinic-1' });
    expect(logs[1]).toMatchObject({ result: 'error', errorCode: 'invalid_input' });
  });

  describe('riskClass deny_non_human (S1)', () => {
    const denyAction = defineAction({
      name: 'atendimento.obterQRCode', module: 'atendimento', requires: 'atendimento:view',
      label: 'Obter QR code', riskClass: 'deny_non_human',
      input: z.object({}).optional(), handler: async () => ({ qrcode: null }),
    });
    const sendAction = defineAction({
      name: 'atendimento.enviarMensagem', module: 'atendimento', requires: 'atendimento:manage_messages',
      label: 'Enviar mensagem', riskClass: 'deny_non_human',
      auditFields: ['conversationId', 'channel', 'idempotencyKey'],
      input: z.object({
        conversationId: z.string().uuid(), message: z.string().min(1),
        channel: z.enum(['whatsapp', 'instagram', 'web']).optional(),
        idempotencyKey: z.string().min(1).max(128).optional(),
      }),
      handler: async () => ({ messageId: 'm1' }),
    });

    it('denies agent_delegated source (forbidden)', async () => {
      const r = await runAction(denyAction, {}, ctx({ source: 'agent_delegated' }));
      expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    });

    it('denies system source (forbidden)', async () => {
      const r = await runAction(denyAction, {}, ctx({ source: 'system', user: undefined, audit: { actor: 'agente (sistema)' } }));
      expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    });

    it('allows human (user) source', async () => {
      const r = await runAction(denyAction, {}, ctx());
      expect(r.ok).toBe(true);
    });

    it('blocks external send for non-human without confirmation path', async () => {
      const r = await runAction(
        sendAction,
        { conversationId: '123e4567-e89b-12d3-a456-426614174000', message: 'oi', channel: 'whatsapp' },
        ctx({ source: 'agent_delegated' }),
      );
      expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
    });

    it('default riskClass preserves current behavior for system source', async () => {
      const r = await runAction(action, { value: 'x' },
        ctx({ source: 'system', user: undefined, audit: { actor: 'agente (sistema)' } }));
      expect(r.ok).toBe(true);
    });

    it('denied call never persists sensitive idempotencyKey (deny logs no input)', async () => {
      const sensitive = 'cpf=123.456.789-00';
      const r = await runAction(
        sendAction,
        {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          message: 'oi',
          channel: 'whatsapp',
          idempotencyKey: sensitive,
        },
        ctx({ source: 'agent_delegated' }),
      );
      expect(r).toEqual({ ok: false, error: { code: 'forbidden', message: expect.any(String) } });
      const last = logs[logs.length - 1];
      expect(last.inputRedacted).toEqual({});
      expect(JSON.stringify(last)).not.toContain(sensitive);
    });

    it('allowed call hashes idempotencyKey instead of persisting raw value', async () => {
      const sensitive = 'cpf=123.456.789-00';
      const r = await runAction(
        sendAction,
        {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          message: 'oi',
          channel: 'whatsapp',
          idempotencyKey: sensitive,
        },
        ctx(),
      );
      expect(r.ok).toBe(true);
      const last = logs[logs.length - 1];
      expect(JSON.stringify(last.inputRedacted)).not.toContain(sensitive);
      expect(last.inputRedacted.conversationId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(last.inputRedacted.channel).toBe('whatsapp');
      expect(typeof last.inputRedacted.idempotencyKey).toBe('string');
      expect(last.inputRedacted.idempotencyKey).toMatch(/^[0-9a-f]{16}$/);
    });

    it('audit log carries only allowlisted fields, no PII/content', async () => {
      await runAction(
        sendAction,
        {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          message: 'texto com PII 11999998888',
          channel: 'whatsapp',
          externalId: '5511999998888',
        },
        ctx(),
      );
      const last = logs[logs.length - 1];
      expect(last.inputRedacted).toEqual({
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        channel: 'whatsapp',
      });
      expect(JSON.stringify(last.inputRedacted)).not.toContain('11999998888');
      expect(JSON.stringify(last.inputRedacted)).not.toContain('texto com PII');
    });
  });
});
