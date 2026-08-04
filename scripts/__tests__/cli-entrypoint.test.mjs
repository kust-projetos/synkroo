import test from 'node:test';
import assert from 'node:assert/strict';
import { isCliInvocation as isSmokeCliInvocation } from '../smoke-staging.mjs';
import { isCliInvocation as isSchemaCliInvocation } from '../verify-remediation-schema.mjs';

for (const [name, isCliInvocation] of [
  ['smoke runner', isSmokeCliInvocation],
  ['schema verifier', isSchemaCliInvocation],
]) {
  test(`${name} recognizes Windows and POSIX module paths`, () => {
    assert.equal(isCliInvocation('file:///D:/projetos/synkroo/scripts/tool.mjs', 'D:\\projetos\\synkroo\\scripts\\tool.mjs'), true);
    assert.equal(isCliInvocation('file:///workspace/scripts/tool.mjs', '/workspace/scripts/tool.mjs'), true);
    assert.equal(isCliInvocation('file:///workspace/scripts/tool.mjs', '/workspace/scripts/other.mjs'), false);
  });
}
