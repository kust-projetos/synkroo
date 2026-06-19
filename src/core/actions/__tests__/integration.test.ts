/** @jest-environment node */

// Integration: usa DB real — desativa o mock do jest.setup.ts
jest.unmock('@/lib/db/client');

// Override o DATABASE_URL fake do jest.setup.ts com o real
process.env.DATABASE_URL = 'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

/**
 * Integration test: Action Layer contra DB real (Gate A — 1.3).
 *
 * Executar apenas com RUN_INTEGRATION_TESTS=1.
 * Requer Postgres local rodando (synkroo-db na porta 55432).
 *
 * Cenários testados:
 *   1. unauthenticated (ctx = null)
 *   2. forbidden (ctx.can → false)
 *   3. module_disabled (ctx.hasModule → false)
 *   4. invalid_input (input falha zod)
 *   5. success (handler retorna dados + log de auditoria)
 */

import { z } from 'zod';
import { runAction } from '../run';
import { defineAction } from '../registry';
import type { ActionContext } from '../types';
import { getDb } from '@/lib/db/client';
import { actionLogs } from '@/lib/db/schema/audit';
import { eq, desc } from 'drizzle-orm';

const testAction = defineAction({
  name: 'core.test_integration', module: 'core', requires: 'core:view',
  label: 'Test integration', input: z.object({ value: z.string() }),
  handler: async (i) => ({ echoed: i.value }),
});

const validCtx: ActionContext = {
  source: 'system',
  clinicId: '00000000-0000-0000-0000-000000000001', // Test Clinic (seeded in local DB)
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'test-runner' },
};

function getLogs(actionName: string) {
  return getDb().select()
    .from(actionLogs)
    .where(eq(actionLogs.actionName, actionName))
    .orderBy(desc(actionLogs.createdAt));
}

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

describeOrSkip('Action Layer — integration (DB real)', () => {
  const ACTION_NAME = 'core.test_integration';

  // Cleanup logs from previous runs
  beforeAll(async () => {
    await getDb().delete(actionLogs).where(eq(actionLogs.actionName, ACTION_NAME));
  });

  afterAll(async () => {
    const { closeDb } = await import('@/lib/db/client');
    await closeDb();
  });

  it('1. unauthenticated — ctx null → error code unauthenticated + log', async () => {
    const r = await runAction(testAction, { value: 'x' }, undefined as any);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('unauthenticated');

    const logs = await getLogs(ACTION_NAME);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].result).toBe('error');
    expect(logs[0].errorCode).toBe('unauthenticated');
  });

  it('2. forbidden — can() false → error code forbidden + log', async () => {
    const r = await runAction(testAction, { value: 'x' }, { ...validCtx, can: () => false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('forbidden');

    const logs = await getLogs(ACTION_NAME);
    expect(logs.some((l) => l.errorCode === 'forbidden')).toBe(true);
  });

  it('3. module_disabled — hasModule() false → error code module_disabled + log', async () => {
    const r = await runAction(testAction, { value: 'x' }, { ...validCtx, hasModule: () => false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('module_disabled');

    const logs = await getLogs(ACTION_NAME);
    expect(logs.some((l) => l.errorCode === 'module_disabled')).toBe(true);
  });

  it('4. invalid_input — zod fail → error code invalid_input + log', async () => {
    const r = await runAction(testAction, { value: 123 }, validCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('invalid_input');

    const logs = await getLogs(ACTION_NAME);
    expect(logs.some((l) => l.errorCode === 'invalid_input')).toBe(true);
  });

  it('5. success — handler returns data + audit log with result ok', async () => {
    const r = await runAction(testAction, { value: 'hello' }, validCtx);
    expect(r).toEqual({ ok: true, data: { echoed: 'hello' } });

    const logs = await getLogs(ACTION_NAME);
    expect(logs.some((l) => l.result === 'ok')).toBe(true);
  });
});
