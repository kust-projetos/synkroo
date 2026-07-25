import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { ESLint } from 'eslint';

const root = resolve(import.meta.dirname, '..', '..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

test('uses flat ESLint CLI with boundary rules', () => {
  assert.equal(packageJson.scripts.lint, 'eslint . --max-warnings=0');
  assert.equal(existsSync(resolve(root, 'eslint.config.mjs')), true);
  const rules = readFileSync(resolve(root, 'eslint.rules.json'), 'utf8');
  assert.match(rules, /"boundaries\/dependencies"/);
});

test('globally ignores generated Next type entrypoint', async () => {
  const eslint = new ESLint({ cwd: root });

  assert.equal(
    await eslint.isPathIgnored(resolve(root, 'next-env.d.ts')),
    true,
  );
});
