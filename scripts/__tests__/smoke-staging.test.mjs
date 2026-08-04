import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSmokeOutput } from '../smoke-staging.mjs';

test('redacts credentials and patient identifiers', () => {
  assert.deepEqual(redactSmokeOutput({ token: 'secret', email: 'patient@example.com', ok: true }), {
    token: '[REDACTED]', email: '[REDACTED]', ok: true,
  });
});
