import test from 'node:test';
import assert from 'node:assert/strict';
import { VERIFY_STEPS, runVerify } from '../verify.mjs';

test('verify defines the required ordered gates', () => {
  assert.deepEqual(VERIFY_STEPS.map((step) => step.name), [
    'lint',
    'typecheck',
    'typecheck:ia-bridge',
    'typecheck:ia-agent',
    'coverage',
    'contracts',
  ]);
});

test('verify stops at the first failed gate', () => {
  const calls = [];
  const result = runVerify({
    execute: (step) => {
      calls.push(step.name);
      return step.name === 'typecheck' ? 1 : 0;
    },
    report: () => undefined,
  });

  assert.equal(result, 1);
  assert.deepEqual(calls, ['lint', 'typecheck']);
});
