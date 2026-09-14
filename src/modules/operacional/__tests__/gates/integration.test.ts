/**
 * Integration test: operacional module gates.
 *
 * Tests that:
 * 1. withModuleRoute returns 404 when operacional module is disabled
 * 2. assertModuleForJob throws ModuleDisabledError when disabled
 * 3. Requests proceed normally when module is enabled
 *
 * Uses a stub manifest to control module state without a real database.
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/operacional/__tests__/gates.integration.test.ts
 */

/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute, assertModuleForJob, ModuleDisabledError } from '@/core/modules/gates';

// ─── Stub manifest ────────────────────────────────────────────────────────────

function makeStubManifest(enabledModules: Set<string>) {
  return {
    async isEnabled(id: string) { return enabledModules.has(id); },
    async enabledModules() { return new Set(enabledModules); },
  };
}

const stubEnabled = makeStubManifest(new Set(['operacional', 'core']));
const stubDisabled = makeStubManifest(new Set(['core']));

// ─── Fake route handlers ──────────────────────────────────────────────────────

async function fakeHandler(_req: NextRequest) {
  return NextResponse.json({ data: 'ok' });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('withModuleRoute — operational module gate', () => {

  it('passes through when operacional is enabled', async () => {
    const wrapped = withModuleRoute('operacional', stubEnabled)(fakeHandler);
    const res = await wrapped(new NextRequest('http://localhost'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: 'ok' });
  });

  it('returns 404 when operacional module is disabled', async () => {
    const wrapped = withModuleRoute('operacional', stubDisabled)(fakeHandler);
    const res = await wrapped(new NextRequest('http://localhost'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('passes route params through when enabled', async () => {
    async function handlerWithParams(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
      const { id } = await ctx.params;
      return NextResponse.json({ id });
    }
    const wrapped = withModuleRoute('operacional', stubEnabled)(handlerWithParams);
    const req = new NextRequest('http://localhost/api/dentists/uuid-123');
    const res = await wrapped(req, { params: Promise.resolve({ id: 'uuid-123' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'uuid-123' });
  });

});

describe('assertModuleForJob — cron job gate', () => {

  it('resolves when operacional is enabled', async () => {
    await expect(assertModuleForJob('operacional', stubEnabled)).resolves.toBeUndefined();
  });

  it('throws ModuleDisabledError when operacional is disabled', async () => {
    await expect(assertModuleForJob('operacional', stubDisabled)).rejects.toBeInstanceOf(ModuleDisabledError);
  });

  it('throws with correct moduleId in error', async () => {
    try {
      await assertModuleForJob('operacional', stubDisabled);
      fail('Expected ModuleDisabledError');
    } catch (err) {
      expect(err).toBeInstanceOf(ModuleDisabledError);
      expect((err as ModuleDisabledError).moduleId).toBe('operacional');
    }
  });

});
