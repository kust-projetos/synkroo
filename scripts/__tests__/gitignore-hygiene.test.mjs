import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const ignoredPaths = [
  '.tmp-check/file',
  '.playwright-cli/file',
  '.playwright-mcp/file',
  '.superpowers/file',
  '_openNextBuild/file',
  'preview.pid',
  '.open-next/file',
  '.wrangler/state/file',
];

test('ignores generated development artifacts', () => {
  for (const path of ignoredPaths) {
    const { status } = spawnSync('git', ['check-ignore', '--no-index', '-q', path], { cwd: root });
    assert.equal(status, 0, `${path} must be ignored`);
  }
});
