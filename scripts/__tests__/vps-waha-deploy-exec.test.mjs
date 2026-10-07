import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { after, before, describe, test } from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const script = resolve(root, 'ops/vps/waha/deploy-waha.sh');
const compose = resolve(root, 'ops/vps/waha/docker-compose.yml');

const DIGEST = 'a'.repeat(64);
const PINNED = `devlikeapro/waha@sha256:${DIGEST}`;

function validEnvBody() {
  return [
    `WAHA_IMAGE_DIGEST=${DIGEST}`,
    'WAHA_ENGINE=NOWEB',
    `WAHA_API_KEY_HASH=sha512:${'b'.repeat(128)}`,
    'WAHA_SWAGGER_USERNAME=private-docs',
    `WAHA_SWAGGER_PASSWORD=${'c'.repeat(32)}`,
    `WAHA_WEBHOOK_HMAC_KEY=${'d'.repeat(64)}`,
    'WAHA_WEBHOOK_URL=',
  ].join('\n') + '\n';
}

function bashCandidates() {
  if (process.platform === 'win32') {
    return [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      'bash',
    ];
  }
  return ['bash'];
}

let BASH_BIN = null;
function hasBash() {
  for (const bin of bashCandidates()) {
    try {
      const r = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 10000 });
      if (r.status === 0) { BASH_BIN = bin; return true; }
    } catch {}
  }
  return false;
}

const BASH_OK = hasBash();
// The 0600 gate cannot pass on Windows (NTFS ACLs report 644 even after
// chmod via MSYS2): behavioral tests run on POSIX CI; the static contract
// suite plus preflight unit tests cover Windows.
const EXEC_OK = BASH_OK && process.platform !== 'win32';

let work;
let bin;
before(() => {
  if (!BASH_OK) return;
  work = mkdtempSync(join(tmpdir(), 'waha-deploy-exec-'));
  bin = join(work, 'bin');
  const calls = join(work, 'calls.log');
  mkdirSync(bin, { recursive: true });
  // Fake docker: behavior driven by env, calls recorded for assertions.
  writeFileSync(join(bin, 'docker'), [
    '#!/bin/bash',
    `CALLS=${JSON.stringify(calls)}`,
    'echo "docker $*" >> "$CALLS"',
    'case "$1" in',
    '  pull) exit "${FAKE_PULL_EXIT:-0}";;',
    '  image) echo "${FAKE_REPO_DIGESTS:-__EMPTY__}"; exit 0;;',
    '  inspect) echo "${FAKE_HEALTH:-healthy}"; exit 0;;',
    '  compose) exit 0;;',
    `  exec) echo "\${FAKE_ENGINE:-NOWEB}"; exit 0;;`,
    '  *) exit 0;;',
    'esac',
  ].join('\n'), { mode: 0o755 });
  writeFileSync(join(bin, 'curl'), '#!/bin/bash\nexit "${FAKE_CURL_EXIT:-0}"\n', { mode: 0o755 });
  writeFileSync(join(bin, 'flock'), '#!/bin/bash\nexit 0\n', { mode: 0o755 });
});
after(() => { if (work) rmSync(work, { recursive: true, force: true }); });

function writeEnv(body) {
  const file = join(work, 'candidate.env');
  writeFileSync(file, body, { encoding: 'utf8', mode: 0o600 });
  try { chmodSync(file, 0o600); } catch {}
  return file;
}

function run(args, extraEnv = {}) {
  const pathSep = process.platform === 'win32' ? ';' : ':';
  // Fresh call log per run: each test asserts only its own invocation.
  try { rmSync(join(work, 'calls.log'), { force: true }); } catch {}
  return spawnSync(BASH_BIN || 'bash', [script, ...args], {
    encoding: 'utf8',
    timeout: 60000,
    env: {
      ...process.env,
      PATH: bin + pathSep + (process.env.PATH || ''),
      WAHA_INSTALL_DIR: join(work, 'install'),
      WAHA_COMPOSE_FILE: compose,
      WAHA_HEALTH_TIMEOUT_SEC: '3',
      FAKE_REPO_DIGESTS: PINNED,
      ...extraEnv,
    },
  });
}

function callsLog() {
  const f = join(work, 'calls.log');
  return existsSync(f) ? readFileSync(f, 'utf8') : '';
}

describe('WAHA deploy script behavior (fake docker, synthetic env)', { skip: !EXEC_OK }, () => {
  test('dry-run validates and never touches docker or disk', () => {
    const envFile = writeEnv(validEnvBody());
    const r = run([envFile]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /dry-run complete/);
    assert.equal(callsLog(), '', 'docker must never be invoked on dry-run');
    assert.equal(existsSync(join(work, 'install')), false, 'install dir must not be created on dry-run');
  });

  test('apply happy path pulls the pinned digest and starts the stack', () => {
    const envFile = writeEnv(validEnvBody());
    const r = run([envFile, '--apply']);
    assert.equal(r.status, 0, r.stderr + '\n' + r.stdout);
    assert.match(r.stdout, /deploy complete/);
    const calls = callsLog();
    assert.match(calls, new RegExp(`pull ${PINNED}`.replace(/[./:]/g, (c) => `\\${c}`)));
    assert.match(calls, /compose .*up -d/);
  });

  test('apply aborts before up on RepoDigest mismatch', () => {
    const envFile = writeEnv(validEnvBody());
    const other = `devlikeapro/waha@sha256:${'e'.repeat(64)}`;
    const r = run([envFile, '--apply'], { FAKE_REPO_DIGESTS: other });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /RepoDigest mismatch/);
    assert.doesNotMatch(callsLog(), /compose/);
  });

  test('apply fails closed on invalid env (no bad-substitution crash)', () => {
    const envFile = writeEnv(validEnvBody().replace(`WAHA_SWAGGER_PASSWORD=${'c'.repeat(32)}`, 'WAHA_SWAGGER_PASSWORD=short'));
    const r = run([envFile, '--apply']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /DEPLOY FAILED/);
    assert.doesNotMatch(r.stderr + r.stdout, /bad substitution/);
  });

  test('apply fails when the container never becomes healthy', () => {
    const envFile = writeEnv(validEnvBody());
    const r = run([envFile, '--apply'], { FAKE_HEALTH: 'starting' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /did not become healthy/);
  });
});
