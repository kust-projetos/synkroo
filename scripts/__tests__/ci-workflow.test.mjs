import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = readFileSync('.github/workflows/ci.yml', 'utf8');
test('CI prepares synkroo before Next build', () => {
  const creation = source.indexOf('CREATE DATABASE');
  const steps = [
    'CREATE EXTENSION IF NOT EXISTS vector',
    'npm run db:migrate',
    'node scripts/seed-test-clinic.mjs',
    'Build (Next.js)',
  ];
  const positions = steps.map((step) => source.indexOf(step, creation));

  assert.notEqual(creation, -1, 'missing CREATE DATABASE');
  assert.match(source.slice(creation, creation + 160), /synkroo/, 'database command must target synkroo');
  for (let index = 0; index < positions.length; index += 1) {
    assert.notEqual(positions[index], -1, `missing ${steps[index]}`);
    assert.ok(index === 0 || positions[index - 1] < positions[index], `${steps[index - 1]} must precede ${steps[index]}`);
  }
});
