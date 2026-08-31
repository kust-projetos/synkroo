import { z } from 'zod';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { defineAction } from '@/core/actions';
import { runAction } from '@/core/actions/run';
import type { ActionContext } from '@/core/actions/types';

const dummyAction = defineAction({
  name: 'test.dummy',
  module: 'core',
  requires: 'core:view',
  label: 'Dummy',
  input: z.object({ value: z.string() }),
  handler: jest.fn(async (input) => ({ ok: true, input })),
});

const ctxA: ActionContext = {
  source: 'user',
  clinicId: '00000000-0000-0000-0000-00000000a001',
  user: { id: 'user-a', email: 'a@test.local', name: 'User A' },
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'user-a' },
};

const CLINIC_B = '00000000-0000-0000-0000-00000000b001';

function findActionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : findActionFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
      ? [path]
      : [];
  });
}

describe('runAction tenant selector guard (W1.4)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects input with clinicId before handler', async () => {
    const handler = dummyAction.handler as jest.Mock;
    const res = await runAction(dummyAction, { value: 'x', clinicId: CLINIC_B } as any, ctxA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('invalid_input');
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects input with clinic_id (snake) before handler', async () => {
    const handler = dummyAction.handler as jest.Mock;
    const res = await runAction(dummyAction, { value: 'x', clinic_id: CLINIC_B } as any, ctxA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('invalid_input');
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows input without clinic selectors', async () => {
    const handler = dummyAction.handler as jest.Mock;
    handler.mockResolvedValueOnce({ ok: true });
    const res = await runAction(dummyAction, { value: 'x' }, ctxA);
    expect(res.ok).toBe(true);
    expect(handler).toHaveBeenCalledWith({ value: 'x' }, expect.any(Object));
  });

  it('does not use value/getter of clinicId key (hasOwnProperty without access)', async () => {
    const handler = dummyAction.handler as jest.Mock;
    let getterCalled = false;
    const input: any = { value: 'x' };
    Object.defineProperty(input, 'clinicId', {
      get() { getterCalled = true; return CLINIC_B; },
      enumerable: true,
      configurable: true,
    });
    const res = await runAction(dummyAction, input, ctxA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('invalid_input');
    expect(handler).not.toHaveBeenCalled();
    expect(getterCalled).toBe(false);
  });

  it('rejects clinicId even when value equals ctx.clinicId (no silent strip)', async () => {
    const handler = dummyAction.handler as jest.Mock;
    const res = await runAction(dummyAction, { value: 'x', clinicId: ctxA.clinicId } as any, ctxA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('invalid_input');
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps production Action schemas free of tenant selectors', () => {
    const actionsRoot = join(process.cwd(), 'src', 'modules');
    const files = findActionFiles(actionsRoot).filter((file) => file.split(sep).includes('actions'));
    expect(files.length).toBeGreaterThan(0);

    const violations = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return /(^|\n)\s*(clinicId|clinic_id)\s*:\s*z\./m.test(source) ? [file] : [];
    });

    expect(violations).toEqual([]);
  });
});
