/**
 * Contract tests for ops/vps/synkroo-prod-postgres static config.
 *
 * Local-only: reads the compose assets from disk, no Docker, no VPS, no
 * secrets. Asserts (i) postgresql.conf pins an explicit hba_file, (ii)
 * pg_hba.conf exposes only hostssl rows (no plaintext `host` rows), and
 * (iii) the postgres service publishes no host port.
 *
 * TODO(PR-C residual): TUNNEL_TOKEN handling is intentionally NOT asserted
 * here — the cloudflared `--token "${TUNNEL_TOKEN}"` host-interpolation
 * contract stays owned by vps-prod-postgres-healthcheck.test.mjs.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const dir = resolve(root, 'ops', 'vps', 'synkroo-prod-postgres');
const postgresqlConf = readFileSync(resolve(dir, 'postgresql.conf'), 'utf8');
const pgHbaConf = readFileSync(resolve(dir, 'pg_hba.conf'), 'utf8');
const composeSource = readFileSync(resolve(dir, 'docker-compose.yml'), 'utf8');

describe('prod-postgres static config contract', () => {
  test("postgresql.conf pins hba_file = '/etc/postgresql/pg_hba.conf'", () => {
    assert.match(
      postgresqlConf,
      /^hba_file = '\/etc\/postgresql\/pg_hba\.conf'\s*$/m,
    );
  });

  test('pg_hba.conf has no plaintext host rows (hostssl only)', () => {
    const rows = pgHbaConf
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
    assert.ok(rows.length > 0, 'pg_hba.conf must keep at least one active row');
    for (const row of rows) {
      assert.doesNotMatch(row, /^host\s/, `plaintext host row forbidden: ${row}`);
      assert.doesNotMatch(row, /^hostnossl\s/, `plaintext hostnossl row forbidden: ${row}`);
    }
    for (const row of rows.filter((r) => !r.startsWith('local'))) {
      assert.match(row, /^hostssl\s/, `non-local row must be hostssl: ${row}`);
    }
    assert.ok(
      rows.some((row) => /^hostssl\s/.test(row)),
      'pg_hba.conf must keep at least one hostssl row',
    );
  });

  test('postgres service publishes no host port', () => {
    const lines = composeSource.split(/\r?\n/);
    const start = lines.findIndex((line) => /^\s{2}postgres:\s*$/.test(line));
    assert.ok(start >= 0, 'postgres service block must exist');
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => /^ {2}\S/.test(line));
    const block = (end === -1 ? rest : rest.slice(0, end)).join('\n');
    assert.doesNotMatch(block, /^\s*ports\s*:/m, 'postgres service must not publish a host port');
  });
});
