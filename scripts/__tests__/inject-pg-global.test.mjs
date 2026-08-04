import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const SCRIPT = new URL('../inject-pg-global.mjs', import.meta.url);

test('keeps the generated pg injection marker ASCII-safe for Wrangler startup analysis', async () => {
  const source = await readFile(SCRIPT, 'utf8');

  assert.match(source, /pg externalizado -> injeta como global/);
  assert.doesNotMatch(source, /pg externalizado [^\x00-\x7F]/);
});
