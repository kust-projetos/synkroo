import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { after, before, describe, test } from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const script = resolve(root, 'ops/vps/waha/deploy-waha.sh');
const scriptText = readFileSync(script, 'utf8');
const compose = resolve(root, 'ops/vps/waha/docker-compose.yml');

const DIGEST = 'a'.repeat(64);
const PINNED = `devlikeapro/waha@sha256:${DIGEST}`;

/** Keys the deploy script must read ONLY from the env file (never inherited). */
const ALLOWED_ENV_KEYS = [
  'WAHA_IMAGE_DIGEST',
  'WAHA_ENGINE',
  'WAHA_API_KEY_HASH',
  'WAHA_SWAGGER_USERNAME',
  'WAHA_SWAGGER_PASSWORD',
  'WAHA_WEBHOOK_HMAC_KEY',
  'WAHA_WEBHOOK_URL',
];

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
  // Sanitized base environment: the script must read the allowlisted WAHA_*
  // keys from the env FILE ONLY. Ambient values are removed so the default
  // tests stay deterministic; the inheritance test injects one explicitly
  // through `extraEnv`.
  const baseEnv = { ...process.env };
  for (const key of ALLOWED_ENV_KEYS) delete baseEnv[key];
  return spawnSync(BASH_BIN || 'bash', [script, ...args], {
    encoding: 'utf8',
    timeout: 60000,
    env: {
      ...baseEnv,
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

  test('apply fails on missing required key', () => {
    const body = validEnvBody().split('\n').filter((l) => !l.startsWith('WAHA_ENGINE=')).join('\n') + '\n';
    const envFile = writeEnv(body);
    const r = run([envFile, '--apply']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /WAHA_ENGINE is unset/);
    assert.doesNotMatch(callsLog(), /compose/);
  });

  test('apply fails when the container never becomes healthy', () => {
    const envFile = writeEnv(validEnvBody());
    const r = run([envFile, '--apply'], { FAKE_HEALTH: 'starting' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /did not become healthy/);
  });

  // ─── Env file is DATA, never code (review blocker: the script sourced it) ──

  test('env file is parsed declaratively — command substitution never runs', () => {
    const marker = join(work, 'must-not-exist');
    try { rmSync(marker, { force: true }); } catch {}
    // A sourced file would execute this; the parser must reject it instead.
    const body = validEnvBody()
      .replace(`WAHA_SWAGGER_PASSWORD=${'c'.repeat(32)}`, `WAHA_SWAGGER_PASSWORD=$(touch ${marker})`);
    const r = run([writeEnv(body), '--apply']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /WAHA_SWAGGER_PASSWORD has an unsupported value/);
    assert.equal(existsSync(marker), false, 'command substitution must never be executed');
    assert.equal(callsLog(), '', 'no docker call may happen on an unparsable env value');

    const backtickBody = validEnvBody()
      .replace(`WAHA_SWAGGER_PASSWORD=${'c'.repeat(32)}`, 'WAHA_SWAGGER_PASSWORD=`touch ' + marker + '`');
    const r2 = run([writeEnv(backtickBody), '--apply']);
    assert.notEqual(r2.status, 0);
    assert.match(r2.stderr + r2.stdout, /WAHA_SWAGGER_PASSWORD has an unsupported value/);
    assert.equal(existsSync(marker), false, 'backtick substitution must never be executed');
    assert.equal(callsLog(), '');
  });

  test('env file rejects arbitrary shell lines, interpolation, quotes and spaces', () => {
    const bodies = [
      validEnvBody() + 'rm -rf /\n',
      validEnvBody() + 'echo PWNED\n',
      validEnvBody() + 'WAHA_SWAGGER_PASSWORD=$(id)\n',
      validEnvBody().replace(`WAHA_SWAGGER_PASSWORD=${'c'.repeat(32)}`, 'WAHA_SWAGGER_PASSWORD=${HOME}'),
      validEnvBody().replace(`WAHA_SWAGGER_PASSWORD=${'c'.repeat(32)}`, `WAHA_SWAGGER_PASSWORD="${'c'.repeat(32)}"`),
      validEnvBody().replace(`WAHA_SWAGGER_PASSWORD=${'c'.repeat(32)}`, `WAHA_SWAGGER_PASSWORD=${'c'.repeat(32)} #trailing`),
    ];

    for (const body of bodies) {
      const r = run([writeEnv(body), '--apply']);
      assert.notEqual(r.status, 0, `must reject: ${JSON.stringify(body.slice(-60))}`);
      assert.match(r.stderr + r.stdout, /unsupported value|is not KEY=value|invalid key name/);
      assert.equal(callsLog(), '', 'no docker call may happen on a rejected env line');
    }
  });

  test('env file rejects duplicate and unknown keys', () => {
    const dup = run([writeEnv(validEnvBody() + 'WAHA_ENGINE=WEBJS\n'), '--apply']);
    assert.notEqual(dup.status, 0);
    assert.match(dup.stderr + dup.stdout, /WAHA_ENGINE is duplicated/);

    const unknown = run([writeEnv(validEnvBody() + 'OTHER_SETTING=value\n'), '--apply']);
    assert.notEqual(unknown.status, 0);
    assert.match(unknown.stderr + unknown.stdout, /OTHER_SETTING is not an allowed setting/);
    assert.equal(callsLog(), '');
  });

  test('a missing required key fails before the pull, even with --apply', () => {
    const required = [
      'WAHA_IMAGE_DIGEST',
      'WAHA_ENGINE',
      'WAHA_API_KEY_HASH',
      'WAHA_SWAGGER_USERNAME',
      'WAHA_SWAGGER_PASSWORD',
      'WAHA_WEBHOOK_HMAC_KEY',
    ];
    for (const missing of required) {
      const body = validEnvBody()
        .split('\n')
        .filter((line) => !line.startsWith(`${missing}=`))
        .join('\n') + '\n';
      const r = run([writeEnv(body), '--apply']);
      assert.notEqual(r.status, 0, `${missing} must be required`);
      assert.match(r.stderr + r.stdout, new RegExp(`${missing} is unset`));
      assert.doesNotMatch(callsLog(), /pull|compose/, `${missing} must fail before any pull`);
    }
  });

  test('an inherited variable does NOT satisfy a key missing from the env file', () => {
    // A sourced env file accepted inherited values, so a missing key could
    // "pass" validation on a stray ambient variable. It must fail closed now.
    const noEngine = validEnvBody()
      .split('\n')
      .filter((line) => !line.startsWith('WAHA_ENGINE='))
      .join('\n') + '\n';
    const r = run([writeEnv(noEngine), '--apply'], { WAHA_ENGINE: 'NOWEB' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /inherited WAHA_ENGINE is set/);
    assert.doesNotMatch(callsLog(), /pull|compose/);

    const noPassword = validEnvBody()
      .split('\n')
      .filter((line) => !line.startsWith('WAHA_SWAGGER_PASSWORD='))
      .join('\n') + '\n';
    const r2 = run([writeEnv(noPassword), '--apply'], { WAHA_SWAGGER_PASSWORD: 'c'.repeat(32) });
    assert.notEqual(r2.status, 0);
    assert.match(r2.stderr + r2.stdout, /inherited WAHA_SWAGGER_PASSWORD is set/);
    assert.doesNotMatch(callsLog(), /pull|compose/);
  });

  test('comments and blank lines are still accepted (parity with preflight.mjs)', () => {
    const lines = ['# leading comment', '', '   # indented comment', ...validEnvBody().trimEnd().split('\n')];
    const r = run([writeEnv(lines.join('\n') + '\n')]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /dry-run complete/);
  });

  test('never prints an env value, only key names', () => {
    const body = validEnvBody().replace(`WAHA_SWAGGER_PASSWORD=${'c'.repeat(32)}`, 'WAHA_SWAGGER_PASSWORD=weak');
    const r = run([writeEnv(body), '--apply']);
    assert.notEqual(r.status, 0);
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(`sha512:${'b'.repeat(128)}`));
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(`${'d'.repeat(64)}`));
  });
});

// ─── E4 review: parity between deploy-waha.sh and canonical preflight.mjs ────
// The Bash script must not become a SECOND, divergent rule set. Every case
// below is decided by BOTH implementations and the verdicts are compared:
// the canonical Node validator (parse + validateWahaConfig) against the real
// Bash checks executed with `bash`.

const canonical = await import(pathToFileURL(resolve(root, 'ops/vps/waha/preflight.mjs')).href);

/** Whole-tool canonical decision: parse the env file, then validate. */
function canonicalAccepts(values) {
  let parsed;
  try {
    parsed = canonical.parseWahaEnvContent(
      Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n'),
    );
  } catch {
    return false; // parse-level rejection (charset, duplicate, unknown key)
  }
  return canonical.validateWahaConfig(parsed).length === 0;
}

const CANONICAL_BASE = {
  WAHA_IMAGE_DIGEST: DIGEST,
  WAHA_ENGINE: 'NOWEB',
  WAHA_API_KEY_HASH: `sha512:${'b'.repeat(128)}`,
  WAHA_SWAGGER_USERNAME: 'private-docs',
  WAHA_SWAGGER_PASSWORD: 'c'.repeat(32),
  WAHA_WEBHOOK_HMAC_KEY: 'd'.repeat(64),
  WAHA_WEBHOOK_URL: '',
};

/** Extracts a whole function body from the shipped script (tests the real code). */
function extractFunction(name) {
  const lines = scriptText.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`${name}() {`));
  assert.notEqual(start, -1, `${name}() must exist in the deploy script`);
  const end = lines.findIndex((line, index) => index > start && line === '}');
  assert.notEqual(end, -1, `${name}() must be closed`);
  return lines.slice(start, end + 1).join('\n');
}

/** Extracts a single `[[ ... =~ ... ]]` validation line by its variable name. */
function extractRegexLine(variable) {
  const line = scriptText
    .split(/\r?\n/)
    .find((candidate) => candidate.includes(variable) && candidate.includes('=~'));
  assert.ok(line, `${variable} must have a regex validation line`);
  return line;
}

/** Runs the shipped Bash rule against `value`: true when the script accepts it. */
function bashAccepts(variable, value, mode) {
  const body = mode === 'function' ? extractFunction(variable) : extractRegexLine(variable);
  const call = mode === 'function'
    ? `${body}\nvalidate_waha_webhook_url "$2"; exit $?`
    : `WAHA_WEBHOOK_HMAC_KEY="$2"; ${body}; exit 0`;
  const result = spawnSync(
    BASH_BIN || 'bash',
    ['-c', `fail() { exit 1; }\n${call}`, 'bash', variable, value],
    { encoding: 'utf8', timeout: 15000 },
  );
  return result.status === 0;
}

// Only URLs that survive the env-file charset gate reach the URL validator —
// `?`, `#`, `@` and spaces are rejected at parse time by BOTH tools, so the
// rows below that use them still compare the same two decisions (raw rule vs
// declarative gate). Everything else is the structural URL contract.
const URL_CASES = [
  ['canonical loopback route', 'https://127.0.0.1:3000/api/whatsapp/waha', true],
  ['canonical public host', 'https://waha.example.com/api/whatsapp/waha', true],
  ['canonical public IPv4 route', 'https://203.0.113.10:3000/api/whatsapp/waha', true],
  ['trailing dot in host is accepted', 'https://waha.example.com./api/whatsapp/waha', true],
  ['scheme is case-insensitive (WHATWG normalizes it)', 'HTTPS://waha.example.com/api/whatsapp/waha', true],
  ['empty port is accepted (WHATWG accepts it)', 'https://waha.example.com:/api/whatsapp/waha', true],
  ['single zero port is accepted', 'https://waha.example.com:0/api/whatsapp/waha', true],
  // WHATWG accepts shorthand/hex IPv4 and rejects out-of-range octets, but
  // the Bash rule cannot express those forms: the contract pins the canonical
  // dotted quad only, and BOTH tools reject every other numeric host.
  ['malformed IPv4 octets (999.999.999.999)', 'https://999.999.999.999/api/whatsapp/waha', false],
  ['numeric host that is not a quad', 'https://2130706433/api/whatsapp/waha', false],
  ['three-octet IPv4 shorthand', 'https://1.2.3/api/whatsapp/waha', false],
  ['five-label numeric host', 'https://1.2.3.4.5/api/whatsapp/waha', false],
  ['leading-zero IPv4 octet', 'https://01.2.3.4/api/whatsapp/waha', false],
  ['hex IPv4 shorthand', 'https://0x7f.1/api/whatsapp/waha', false],
  // WHATWG hexadecimal-number hosts: the parser renormalizes the host
  // (`0x7f` → `0.0.0.127`, `1.2.3.0xff` → `1.2.3.255`) or rejects the whole
  // authority (`example.0xff`). Both tools refuse a FINAL hex-number label so
  // the canonical host stays byte-identical — a DNS-legal final `0xff` is a
  // deliberate casualty. Only the FINAL label is checked.
  ['hex-number final label on a DNS host', 'https://example.0xff/api/whatsapp/waha', false],
  ['hex-number host normalized by WHATWG to 0.0.0.127', 'https://0x7f/api/whatsapp/waha', false],
  ['hex-number final octet normalized by WHATWG to 1.2.3.255', 'https://1.2.3.0xff/api/whatsapp/waha', false],
  ['hex-number final label is case-insensitive', 'https://0X7F/api/whatsapp/waha', false],
  // WHATWG hex-number labels with ZERO hex digits. WHATWG reads `0x`/`0X` as
  // the number 0 (`0x` → `0.0.0.0`, `1.2.3.0x` → `1.2.3.0`) and fails the whole
  // authority for `example.0x`. Reviewer edge (E4): a `+` quantifier in the
  // hex-label rule let the bare `0x` through as an ordinary DNS label; the
  // shared rule uses `*`, so both tools refuse those forms as well.
  ['bare hex-number final label with zero hex digits (example.0x)', 'https://example.0x/api/whatsapp/waha', false],
  ['lone hex-number host with zero hex digits (0x → 0.0.0.0)', 'https://0x/api/whatsapp/waha', false],
  ['hex-number final octet with zero hex digits (1.2.3.0x → 1.2.3.0)', 'https://1.2.3.0x/api/whatsapp/waha', false],
  ['hex-number label with zero hex digits is case-insensitive (0X)', 'https://0X/api/whatsapp/waha', false],
  ['trailing dot with a zero-hex-digit final label (example.0x.)', 'https://example.0x./api/whatsapp/waha', false],
  ['hex-number label that is NOT final stays a DNS host', 'https://0xapp.example.com/api/whatsapp/waha', true],
  // Guard against overblocking: `0xapp` is a legal DNS label (`p` is not a hex
  // digit), so it must stay accepted even as the FINAL label.
  ['DNS-legal 0xapp as a FINAL label stays valid', 'https://0xapp/api/whatsapp/waha', true],
  ['underscore is not a DNS-like label', 'https://waha_example.com/api/whatsapp/waha', false],
  ['host label starts with a hyphen', 'https://-waha.example.com/api/whatsapp/waha', false],
  ['empty label in host', 'https://waha..example.com/api/whatsapp/waha', false],
  // Port: zero-padded values are rejected by BOTH tools instead of being
  // silently normalized to 443.
  ['port with leading zeros (000443)', 'https://waha.example.com:000443/api/whatsapp/waha', false],
  ['port with leading zeros (00443)', 'https://waha.example.com:00443/api/whatsapp/waha', false],
  ['extra path segment before the route', 'https://waha.example.com/extra/api/whatsapp/waha', false],
  ['trailing slash', 'https://waha.example.com/api/whatsapp/waha/', false],
  ['route case differs', 'https://waha.example.com/API/WHATSAPP/WAHA', false],
  ['missing path', 'https://waha.example.com', false],
  ['plain HTTP', 'http://waha.example.com/api/whatsapp/waha', false],
  ['invalid port (65536)', 'https://waha.example.com:65536/api/whatsapp/waha', false],
  ['invalid port (non-numeric)', 'https://waha.example.com:https/api/whatsapp/waha', false],
  ['malformed host (empty authority)', 'https:///api/whatsapp/waha', false],
  ['malformed host (port only)', 'https://:3000/api/whatsapp/waha', false],
  // The path must be EXACT in the RAW string: WHATWG hides dot segments.
  ['dot-segment path normalizes into the route', 'https://waha.example.com/x/../api/whatsapp/waha', false],
  ['single-dot path segment', 'https://waha.example.com/./api/whatsapp/waha', false],
  ['query string after the route', 'https://waha.example.com/api/whatsapp/waha?x=1', false],
  ['fragment after the route', 'https://waha.example.com/api/whatsapp/waha#f', false],
  ['credentials in the authority', 'https://user:pass@waha.example.com/api/whatsapp/waha', false],
];

const HMAC_CASES = [
  ['64 safe chars', 'd'.repeat(64), true],
  ['exactly 32 safe chars', 'e'.repeat(32), true],
  ['underscore and hyphen are safe', `${'Ab1_-'.repeat(6)}Abcd`, true],
  ['too short (31 chars)', 'e'.repeat(31), false],
  ['dot is not in the safe charset', `${'d'.repeat(31)}.`, false],
  ['slash is not in the safe charset', `${'d'.repeat(31)}/`, false],
  ['colon is not in the safe charset', `${'d'.repeat(31)}:`, false],
];

describe('WAHA deploy script validation matches the canonical preflight', { skip: !BASH_OK }, () => {
  test('webhook URL accept/reject set is identical to preflight.mjs', () => {
    for (const [label, url, expected] of URL_CASES) {
      assert.equal(
        bashAccepts('validate_waha_webhook_url', url, 'function'),
        expected,
        `bash disagrees on ${label}: ${url}`,
      );
      assert.equal(
        canonicalAccepts({ ...CANONICAL_BASE, WAHA_WEBHOOK_URL: url }),
        expected,
        `canonical disagrees on ${label}: ${url}`,
      );
    }
  });

  test('HMAC key charset/length rule is identical to preflight.mjs', () => {
    for (const [label, value, expected] of HMAC_CASES) {
      assert.equal(
        bashAccepts('WAHA_WEBHOOK_HMAC_KEY', value),
        expected,
        `bash disagrees on ${label}`,
      );
      assert.equal(
        canonicalAccepts({ ...CANONICAL_BASE, WAHA_WEBHOOK_HMAC_KEY: value }),
        expected,
        `canonical disagrees on ${label}`,
      );
    }
  });

  test('the loose URL regex and the length-only HMAC check are gone', () => {
    // Review: these two forms accepted values the canonical validator rejects.
    assert.doesNotMatch(scriptText, /\^https:\/\[\^?#\]\*\\\/api\/whatsapp\/waha\$/);
    assert.doesNotMatch(scriptText, /\$\{#WAHA_WEBHOOK_HMAC_KEY\}" -ge 32/);
    assert.match(scriptText, /validate_waha_webhook_url "\$WAHA_WEBHOOK_URL"/);
    assert.match(scriptText, /\[Hh\]\[Tt\]\[Tt\]\[Pp\]\[Ss\]:\/\//);
  });
});

// ─── Node-level contract checks on the canonical side of the shared rule ─────
// The parity matrix above compares BOTH implementations; these assertions pin
// the canonical helper directly, including the forms WHATWG would normalize
// away (dot segments, zero-padded ports, shorthand IPv4).
describe('WAHA canonical webhook URL helper (preflight.mjs)', () => {
  const canonicalCases = [
    ['https://waha.example.com/api/whatsapp/waha', true],
    ['https://127.0.0.1:3000/api/whatsapp/waha', true],
    ['HTTPS://waha.example.com./api/whatsapp/waha', true],
    ['https://waha.example.com:000443/api/whatsapp/waha', false],
    ['https://waha.example.com:00443/api/whatsapp/waha', false],
    ['https://waha.example.com:65536/api/whatsapp/waha', false],
    ['https://waha.example.com/x/../api/whatsapp/waha', false],
    ['https://waha.example.com/./api/whatsapp/waha', false],
    ['https://999.999.999.999/api/whatsapp/waha', false],
    ['https://2130706433/api/whatsapp/waha', false],
    ['https://01.2.3.4/api/whatsapp/waha', false],
    ['https://0x7f.1/api/whatsapp/waha', false],
    ['https://example.0xff/api/whatsapp/waha', false],
    ['https://0x7f/api/whatsapp/waha', false],
    ['https://1.2.3.0xff/api/whatsapp/waha', false],
    ['https://0X7F/api/whatsapp/waha', false],
    ['https://example.0x/api/whatsapp/waha', false],
    ['https://0x/api/whatsapp/waha', false],
    ['https://1.2.3.0x/api/whatsapp/waha', false],
    ['https://0X/api/whatsapp/waha', false],
    ['https://example.0x./api/whatsapp/waha', false],
    ['https://0xapp.example.com/api/whatsapp/waha', true],
    ['https://0xapp/api/whatsapp/waha', true],
    ['https://waha.example.com/api/whatsapp/waha?x=1', false],
    ['https://user:pass@waha.example.com/api/whatsapp/waha', false],
  ];

  test('host and URL helpers encode the shared contract', () => {
    for (const [url, expected] of canonicalCases) {
      assert.equal(canonical.isWahaWebhookUrl(url), expected, `isWahaWebhookUrl(${url})`);
    }
    for (const [host, expected] of [
      ['waha.example.com', true],
      ['waha.example.com.', true],
      ['127.0.0.1', true],
      ['255.255.255.255', true],
      ['999.999.999.999', false],
      ['2130706433', false],
      ['1.2.3', false],
      ['01.2.3.4', false],
      ['0x7f.1', false],
      ['example.0xff', false],
      ['0x7f', false],
      ['1.2.3.0xff', false],
      ['0X7F', false],
      ['example.0x', false],
      ['0x', false],
      ['1.2.3.0x', false],
      ['0X', false],
      ['example.0x.', false],
      ['0xapp.example.com', true],
      ['0xapp', true],
      ['waha_example.com', false],
      ['-waha.example.com', false],
      ['waha..example.com', false],
      ['', false],
    ]) {
      assert.equal(canonical.isWahaWebhookHost(host), expected, `isWahaWebhookHost(${host})`);
    }
  });
});

describe('WAHA deploy script rejects divergent values before any docker call', { skip: !EXEC_OK }, () => {
  const rejected = [
    ['extra path segment in the webhook URL', 'WAHA_WEBHOOK_URL=https://waha.example.com/extra/api/whatsapp/waha'],
    ['invalid webhook port', 'WAHA_WEBHOOK_URL=https://waha.example.com:65536/api/whatsapp/waha'],
    ['malformed webhook host', 'WAHA_WEBHOOK_URL=https:///api/whatsapp/waha'],
    ['malformed IPv4 webhook host', 'WAHA_WEBHOOK_URL=https://999.999.999.999/api/whatsapp/waha'],
    ['hex-number final webhook host label', 'WAHA_WEBHOOK_URL=https://example.0xff/api/whatsapp/waha'],
    ['hex-number webhook host normalized by WHATWG', 'WAHA_WEBHOOK_URL=https://0x7f/api/whatsapp/waha'],
    ['hex-number final webhook octet normalized by WHATWG', 'WAHA_WEBHOOK_URL=https://1.2.3.0xff/api/whatsapp/waha'],
    ['bare hex-number final webhook host label with zero hex digits', 'WAHA_WEBHOOK_URL=https://example.0x/api/whatsapp/waha'],
    ['lone hex-number webhook host with zero hex digits', 'WAHA_WEBHOOK_URL=https://0x/api/whatsapp/waha'],
    ['hex-number final webhook octet with zero hex digits', 'WAHA_WEBHOOK_URL=https://1.2.3.0x/api/whatsapp/waha'],
    ['webhook port with leading zeros', 'WAHA_WEBHOOK_URL=https://waha.example.com:000443/api/whatsapp/waha'],
    ['dot-segment webhook path', 'WAHA_WEBHOOK_URL=https://waha.example.com/x/../api/whatsapp/waha'],
    ['non-HTTPS webhook URL', 'WAHA_WEBHOOK_URL=http://waha.example.com/api/whatsapp/waha'],
    ['non-safe HMAC charset', `WAHA_WEBHOOK_HMAC_KEY=${'d'.repeat(31)}.`],
    ['short HMAC key', `WAHA_WEBHOOK_HMAC_KEY=${'d'.repeat(31)}`],
  ];

  for (const [label, assignment] of rejected) {
    test(`${label} → aborts with DEPLOY FAILED and never touches docker`, () => {
      const separator = assignment.indexOf('=');
      const key = assignment.slice(0, separator);
      const body = `${validEnvBody()
        .split('\n')
        .filter((line) => !line.startsWith(`${key}=`))
        .join('\n')}\n${assignment}\n`;
      const r = run([writeEnv(body), '--apply']);
      assert.notEqual(r.status, 0, `${label} must be rejected`);
      assert.match(r.stderr + r.stdout, /DEPLOY FAILED/);
      assert.doesNotMatch(callsLog(), /pull|compose/, `${label} must fail before any pull`);
    });
  }

  test('a valid loopback webhook URL with an explicit port still passes', () => {
    const body = validEnvBody().replace(
      'WAHA_WEBHOOK_URL=',
      'WAHA_WEBHOOK_URL=https://127.0.0.1:3000/api/whatsapp/waha',
    );
    const r = run([writeEnv(body)]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /dry-run complete/);
    assert.equal(callsLog(), '');
  });
});
