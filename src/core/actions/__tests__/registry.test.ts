import { z } from 'zod';
import { defineAction, registerActions, getActions, getAction, clearRegistry } from '../registry';

const sample = defineAction({
  name: 'core.ping', module: 'core', requires: 'core:ping', label: 'Ping',
  input: z.object({}), handler: async () => 'pong',
});

describe('action registry', () => {
  beforeEach(() => clearRegistry());

  it('defineAction does not register by side effect', () => {
    expect(getActions()).toHaveLength(0);   // só registra via registerActions
  });

  it('registers actions explicitly and retrieves by name', () => {
    registerActions([sample]);
    expect(getActions()).toHaveLength(1);
    expect(getAction('core.ping')).toBe(sample);
  });

  it('throws on duplicate action name', () => {
    registerActions([sample]);
    expect(() => registerActions([sample])).toThrow(/duplicate/i);
  });
});
