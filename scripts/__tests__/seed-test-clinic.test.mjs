import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../seed-test-clinic.mjs', import.meta.url), 'utf8');

test('E2E seed provisions the clinic and credentials expected by global setup', () => {
  assert.match(source, /clinica-demo/);
  assert.match(source, /admin@clinicademo\.com/);
  assert.match(source, /user_credentials/);
});
