/**
 * Integration test: followup module gates.
 *
 * Tests that:
 * 1. withModuleRoute returns 404 when followup module is disabled
 * 2. assertModuleForJob throws ModuleDisabledError when disabled
 * 3. Requests proceed normally when module is enabled
 *
 * Uses a stub manifest to control module state without a real database.
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/followup/__tests__/gates/integration.test.ts
 */

/** @jest-environment node */

process.env.DATABASE_URL =
  'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute, assertModuleForJob, ModuleDisabledError } from '@/core/modules/gates';

// ─── Stub manifest ────────────────────────────────────────────────────────────

function makeStubManifest(enabledModules: Set<string>) {
  return {
    async isEnabled(id: string) { return enabledModules.has(id); },
    async enabledModules() { return new Set(enabledModules); },
  };
}

const stubEnabled = makeStubManifest(new Set(['followup', 'core']));
const stubDisabled = makeStubManifest(new Set(['core']));

// ─── Fake route handlers ──────────────────────────────────────────────────────

async function fakeHandler(_req: NextRequest) {
  return NextResponse.json({ data: 'ok' });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('withModuleRoute — followup module gate', () => {

  it('passes through when followup is enabled', async () => {
    const wrapped = withModuleRoute('followup', stubEnabled)(fakeHandler);
    const res = await wrapped(new NextRequest('http://localhost'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: 'ok' });
  });

  it('returns 404 when followup module is disabled', async () => {
    const wrapped = withModuleRoute('followup', stubDisabled)(fakeHandler);
    const res = await wrapped(new NextRequest('http://localhost'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });

  it('passes route params through when enabled', async () => {
    async function handlerWithParams(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
      const { id } = await ctx.params;
      return NextResponse.json({ id });
    }
    const wrapped = withModuleRoute('followup', stubEnabled)(handlerWithParams);
    const req = new NextRequest('http://localhost/api/followup/patients/inactive');
    const res = await wrapped(req, { params: Promise.resolve({ id: 'uuid-123' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'uuid-123' });
  });

});

describe('assertModuleForJob — cron job gate', () => {

  it('resolves when followup is enabled', async () => {
    await expect(assertModuleForJob('followup', stubEnabled)).resolves.toBeUndefined();
  });

  it('throws ModuleDisabledError when followup is disabled', async () => {
    await expect(assertModuleForJob('followup', stubDisabled)).rejects.toBeInstanceOf(ModuleDisabledError);
  });

  it('throws with correct moduleId in error', async () => {
    try {
      await assertModuleForJob('followup', stubDisabled);
      fail('Expected ModuleDisabledError');
    } catch (err) {
      expect(err).toBeInstanceOf(ModuleDisabledError);
      expect((err as ModuleDisabledError).moduleId).toBe('followup');
    }
  });

});
