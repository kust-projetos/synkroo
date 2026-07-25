import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const workflow = readFileSync(resolve('.github/workflows/ci.yml'), 'utf8');

test('runs CI for slash-named push branches', () => {
  assert.match(workflow, /push:\s*\n\s*branches:\s*\['\*\*'\]/);
});
