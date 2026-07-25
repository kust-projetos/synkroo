import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const script = readFileSync(resolve(import.meta.dirname, '..', 'setup-env.sh'), 'utf8');

test('generates CRON_SECRET at setup time without embedding a credential', () => {
  assert.match(script, /require\('node:crypto'\)\.randomBytes\(48\)\.toString\('base64url'\)/);
  assert.match(script, /grep -q "\^CRON_SECRET=" \.env\.local/);
  assert.match(script, /CRON_SECRET=<gerado-pelo-script>/);
  assert.doesNotMatch(script, /CRON_SECRET="[A-Za-z0-9+/=_-]{32,}"/);
});
