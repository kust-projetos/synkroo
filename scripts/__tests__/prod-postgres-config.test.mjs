/**
 * Contract tests for ops/vps/synkroo-prod-postgres static config.
 *
 * Local-only: reads the compose assets from disk, no Docker, no VPS, no
 * secrets. Asserts (i) postgresql.conf pins an explicit hba_file, (ii)
 * pg_hba.conf exposes only hostssl rows (no plaintext `host` rows),
 * (iii) the postgres service publishes no host port, and (iv) the
 * cloudflared Tunnel token travels via `--token-file` (bind mount
 * read-only, host path outside the repo) — never as argv `--token <valor>`
 * nor as visible env.
 *
 * Ownership: this file owns the STATIC token-file contract (source text).
 * The RENDERED contract (`docker compose config` sem segredo, fail-closed
 * sem a var, provas em container descartável) lives in
 * vps-prod-postgres-healthcheck.test.mjs.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const dir = resolve(root, 'ops', 'vps', 'synkroo-prod-postgres');
const postgresqlConf = readFileSync(resolve(dir, 'postgresql.conf'), 'utf8');
const pgHbaConf = readFileSync(resolve(dir, 'pg_hba.conf'), 'utf8');
const composeSource = readFileSync(resolve(dir, 'docker-compose.yml'), 'utf8');

const TOKEN_PATH = '/run/secrets/tunnel_token';

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

describe('prod-postgres cloudflared token-file static contract', () => {
  test('cloudflared image stays pinned', () => {
    assert.match(composeSource, /image: cloudflare\/cloudflared:2026\.7\.2/);
  });

  test('token travels via --token-file <path>, never as argv value', () => {
    assert.match(
      composeSource,
      /"tunnel", "--no-autoupdate", "run", "--token-file", "\/run\/secrets\/tunnel_token"/,
      'cloudflared command must use --token-file with the fixed container path',
    );
    // No bare `--token` flag (with a value) anywhere: the token must not
    // appear in argv, where `docker inspect`/`ps` would expose it.
    assert.doesNotMatch(composeSource, /"--token"(?!-file)/, 'bare --token flag is forbidden');
  });

  test('no TUNNEL_TOKEN value interpolation or env survives', () => {
    assert.doesNotMatch(composeSource, /TUNNEL_TOKEN(?!_FILE_PATH)/, 'only TUNNEL_TOKEN_FILE_PATH may appear, never a token value');
    assert.doesNotMatch(composeSource, /\$\{TUNNEL_TOKEN\}/, 'host-interpolated token value is forbidden');
  });

  test('token file is a read-only bind mount with a fail-closed host path', () => {
    // Long-form bind (no colon-splitting of Windows drive letters), target
    // fixed, read-only. `${VAR:?...}` makes `config`/`up` fail closed with
    // an actionable message when the host path is not provided.
    assert.match(composeSource, /type: bind/);
    assert.match(
      composeSource,
      /\bsource: \$\{TUNNEL_TOKEN_FILE_PATH:\?.+\}/,
      'mount source must require TUNNEL_TOKEN_FILE_PATH with an error message',
    );
    assert.match(composeSource, new RegExp(`target: ${TOKEN_PATH.replaceAll('/', '\\/')}`));
    assert.match(composeSource, /read_only: true/);
  });

  test('no token/secret file lives inside the versioned ops dir', () => {
    // The token file lives on the host OUTSIDE the repo checkout; pin that
    // no `secrets/` dir or token-named file was added under version control.
    const entries = readdirSync(dir);
    for (const entry of entries) {
      assert.doesNotMatch(entry, /secret|token/i, `token material inside the repo is forbidden: ${entry}`);
    }
  });

  test('runbook documents the token-file lifecycle', () => {
    const docs = readFileSync(resolve(root, 'docs', 'ops', 'vps-access.md'), 'utf8');
    assert.match(docs, /TUNNEL_TOKEN_FILE_PATH/, 'runbook must name the host path variable');
    assert.match(docs, /0600/, 'runbook must pin the 0600 host permission');
    assert.match(docs, /staging[\s\S]{0,400}distint|DISTINT[\s\S]{0,400}staging/i, 'runbook must require distinct staging/prod tokens');
  });
});
