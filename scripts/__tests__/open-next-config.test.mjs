import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

test('OpenNext uses KV incremental cache instead of dummy cache', async () => {
  const config = await readFile(new URL('../../open-next.config.ts', import.meta.url), 'utf8');
  assert.match(config, /incremental-cache\/kv-incremental-cache/);
  assert.doesNotMatch(config, /incrementalCache:\s*["']dummy["']/);
});
