import { makeManifest } from '../manifest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

it('reports enabled modules and defaults missing to disabled', async () => {
  const m = makeManifest({ getEnabledModuleIds: async () => ['operacional'] });
  expect(await m.isEnabled('operacional')).toBe(true);
  expect(await m.isEnabled('financeiro')).toBe(false);
});

it('always-on modules (core) are enabled regardless of contract', async () => {
  const m = makeManifest({ getEnabledModuleIds: async () => [] });
  expect(await m.isEnabled('core')).toBe(true);
});

it('caches the lookup within an instance', async () => {
  let calls = 0;
  const m = makeManifest({ getEnabledModuleIds: async () => { calls++; return ['core']; } });
  await m.isEnabled('core'); await m.isEnabled('operacional');
  expect(calls).toBe(1);
});

it('two instances observe different contracts immediately (no global cache)', async () => {
  const m1 = makeManifest({ getEnabledModuleIds: async () => ['operacional'] });
  const m2 = makeManifest({ getEnabledModuleIds: async () => [] });
  expect(await m1.isEnabled('operacional')).toBe(true);
  expect(await m2.isEnabled('operacional')).toBe(false);
  // Change contract and verify immediate observation
  const dynamicRepo = { ids: ['operacional'] as string[], getEnabledModuleIds: async function() { return this.ids; } };
  const m3 = makeManifest(dynamicRepo);
  expect(await m3.isEnabled('operacional')).toBe(true);
  dynamicRepo.ids = [];
  const m4 = makeManifest(dynamicRepo);
  expect(await m4.isEnabled('operacional')).toBe(false);
});

it('does not export singleton moduleManifest (guard)', () => {
  const content = readFileSync(resolve(process.cwd(), 'src/core/modules/manifest.ts'), 'utf8');
  expect(content).not.toMatch(/export\s+const\s+moduleManifest/);
  expect(content).toMatch(/export function createManifest/);
  expect(content).toMatch(/export function makeManifest/);
});

it('no production file imports singleton moduleManifest', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const files: string[] = [];
  function walk(dir: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (full.endsWith('.ts') && !full.includes('__tests__') && !full.includes('.test.')) files.push(full);
    }
  }
  walk(path.resolve(process.cwd(), 'src/app'));
  walk(path.resolve(process.cwd(), 'src/modules'));
  walk(path.resolve(process.cwd(), 'src/core'));
  walk(path.resolve(process.cwd(), 'src/lib'));
  const violations: string[] = [];
  for (const file of files) {
    const c = fs.readFileSync(file, 'utf8');
    if (/from\s+['"]@\/core\/modules\/manifest['"]/.test(c) && /moduleManifest/.test(c)) {
      violations.push(file);
    }
  }
  expect(violations).toEqual([]);
});
