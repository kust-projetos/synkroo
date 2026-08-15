import test from 'node:test';
import assert from 'node:assert/strict';
import { isMainModule, parseArgs } from '../backfill-rbac-permissions.mjs';

test('backfill CLI defaults to dry-run and accepts only explicit --apply', () => {
  assert.deepEqual(parseArgs([]), { apply: false });
  assert.deepEqual(parseArgs(['--apply']), { apply: true });
  assert.throws(() => parseArgs(['--force']), /Usage/);
});

test('backfill import is not treated as CLI entrypoint', () => {
  assert.equal(isMainModule('file:///workspace/scripts/backfill-rbac-permissions.mjs', '/workspace/scripts/other.mjs'), false);
});
