import { z } from 'zod';
import { defineAction, registerActions, clearRegistry } from '../registry';
import { agentToolsFor } from '../agent';
import type { ActionContext } from '../types';

const a1 = defineAction({ name: 'op.a', module: 'op', requires: 'op:a', label: 'A', input: z.object({}), handler: async () => 1 });
const a2 = defineAction({ name: 'fin.b', module: 'fin', requires: 'fin:b', label: 'B', input: z.object({}), handler: async () => 2 });

function ctx(over: Partial<ActionContext> = {}): ActionContext {
  return { source: 'system', clinicId: 'c1', can: () => true, hasModule: () => true, audit: { actor: 'agente (sistema)' }, ...over };
}

describe('agentToolsFor', () => {
  beforeEach(() => { clearRegistry(); registerActions([a1, a2]); });

  it('exposes only tools whose module is enabled and permitted', () => {
    const tools = agentToolsFor(ctx({ hasModule: (m) => m === 'op', can: () => true }));
    expect(tools.map((t) => t.name)).toEqual(['op.a']);
  });

  it('excludes tools the principal cannot run', () => {
    const tools = agentToolsFor(ctx({ hasModule: () => true, can: (k) => k === 'op:a' }));
    expect(tools.map((t) => t.name)).toEqual(['op.a']);
  });
});
