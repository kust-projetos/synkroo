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
});
