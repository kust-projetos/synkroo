import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { after, describe, test } from 'node:test';
import {
  findInheritedWahaOverrides,
  isPrivateFileMode,
  parseWahaEnvContent,
  validateWahaConfig,
} from '../../ops/vps/waha/preflight.mjs';

const root = resolve(import.meta.dirname, '..', '..');
const wahaDir = resolve(root, 'ops/vps/waha');
const compose = readFileSync(resolve(wahaDir, 'docker-compose.yml'), 'utf8');
const envExample = readFileSync(resolve(wahaDir, '.env.example'), 'utf8');
const readme = readFileSync(resolve(wahaDir, 'README.md'), 'utf8');
const preflightPath = resolve(wahaDir, 'preflight.mjs');
const preflightSource = readFileSync(preflightPath, 'utf8');
const backupScript = readFileSync(resolve(root, 'ops/vps/contabo/backup/backup-synkroo.sh'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const validConfig = {
  WAHA_IMAGE_DIGEST: 'a'.repeat(64),
  WAHA_ENGINE: 'NOWEB',
  WAHA_API_KEY_HASH: `sha512:${'b'.repeat(128)}`,
  WAHA_SWAGGER_USERNAME: 'private-docs',
  WAHA_SWAGGER_PASSWORD: 'c'.repeat(32),
  WAHA_WEBHOOK_HMAC_KEY: 'd'.repeat(64),
  WAHA_WEBHOOK_URL: '',
};
const validEnvBody = Object.entries(validConfig).map(([key, value]) => `${key}=${value}`).join('\n');

const tempDir = mkdtempSync(join(tmpdir(), 'waha-preflight-'));
after(() => rmSync(tempDir, { recursive: true, force: true }));

function writeEnv(values) {
  const file = join(tempDir, 'candidate.env');
  const body = Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
  writeFileSync(file, body, { encoding: 'utf8', mode: 0o600 });
  return file;
}

describe('WAHA loopback-only target candidate scaffold', () => {
  test('image is an immutable required reference; engine has no default', () => {
    assert.match(compose, /image:\s*["']?devlikeapro\/waha@sha256:\$\{WAHA_IMAGE_DIGEST:\?/);
    assert.doesNotMatch(compose, /devlikeapro\/waha:latest/i);
    assert.match(compose, /WHATSAPP_DEFAULT_ENGINE:\s*["']?\$\{WAHA_ENGINE:\?/);
    assert.ok(preflightSource.includes('WAHA_IMAGE_DIGEST'));
    assert.match(envExample, /candidate.*not yet approved/i);
  });

  test('container is loopback-only with no public router/network/host port', () => {
    assert.match(compose, /127\.0\.0\.1:3000:3000/);
    assert.doesNotMatch(compose, /^\s*-\s*["']?0\.0\.0\.0:3000/m);
    assert.doesNotMatch(compose, /traefik\.http\.routers|traefik\.enable|external:\s*true/i);
    assert.match(compose, /WAHA_DASHBOARD_ENABLED:\s*["']false["']/);
    assert.match(readme, /loopback-only/i);
    assert.match(readme, /no\s+Traefik router/i);
  });

  test('persists session data and has bounded health/log settings', () => {
    assert.match(compose, /waha_sessions:\/app\/\.sessions/);
    assert.match(compose, /name:\s*synkroo_waha_sessions_candidate/);
    assert.match(compose, /fetch\('http:\/\/127\.0\.0\.1:3000\/health'\)/);
    assert.match(compose, /start_period:/);
    assert.match(compose, /max-size:/);
    assert.match(compose, /max-file:/);
    assert.match(compose, /restart:\s*unless-stopped/);
  });

  test('keeps auth and webhook configuration fail-closed', () => {
    assert.match(compose, /WAHA_API_KEY:\s*["']?\$\{WAHA_API_KEY_HASH:\?/);
    assert.match(compose, /WAHA_API_KEY_EXCLUDE_PATH:\s*health/);
    assert.match(compose, /WHATSAPP_SWAGGER_PASSWORD:\s*["']?\$\{WAHA_SWAGGER_PASSWORD:\?/);
    assert.match(compose, /WHATSAPP_HOOK_URL:\s*["']?\$\{WAHA_WEBHOOK_URL:-\}/);
    assert.match(compose, /WHATSAPP_HOOK_HMAC_KEY:\s*["']?\$\{WAHA_WEBHOOK_HMAC_KEY:\?/);
    assert.doesNotMatch(compose, /WAHA_NO_API_KEY|DASHBOARD_NO_PASSWORD|SWAGGER_NO_PASSWORD/);
  });

  test('.env.example is comments/placeholders only, with a documented non-approved digest candidate', () => {
    const activeAssignments = envExample
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trimStart().startsWith('#') && /^[A-Z0-9_]+=/.test(line.trim()));
    assert.deepEqual(activeAssignments, []);
    assert.match(envExample, /WAHA_API_KEY_HASH=sha512:/);
    assert.match(envExample, /WAHA_WEBHOOK_HMAC_KEY/);
    assert.match(envExample, /WAHA_ENGINE/);
    assert.match(envExample, /WAHA_IMAGE_DIGEST=41283bd89922ec3f722e5a772b844c451634d4aa72e9c34043c3480184f970fe/);
  });

  test('preflight accepts valid synthetic config and returns no values', () => {
    assert.deepEqual(validateWahaConfig(validConfig), []);
  });

  test('preflight rejects floating tags, unsupported engine and invalid hashes by key name only', () => {
    const errors = validateWahaConfig({
      ...validConfig,
      WAHA_IMAGE_DIGEST: 'latest',
      WAHA_ENGINE: 'unknown',
      WAHA_API_KEY_HASH: 'wrong-key-format-with-marker-do-not-print',
    });

    assert.match(errors.join('\n'), /WAHA_IMAGE_DIGEST/);
    assert.match(errors.join('\n'), /WAHA_ENGINE/);
    assert.match(errors.join('\n'), /WAHA_API_KEY_HASH/);
    assert.doesNotMatch(errors.join('\n'), /wrong-key-format-with-marker-do-not-print/);
  });

  test('dotenv parser rejects comments, quotes, interpolation, duplicates and unknown keys', () => {
    const invalidLines = [
      'WAHA_SWAGGER_PASSWORD=weak #abcdefghijklmnopqrstuvwx',
      'WAHA_SWAGGER_PASSWORD="strong-but-quoted-value"',
      'WAHA_SWAGGER_PASSWORD=${INJECTED_VALUE}',
      `${validEnvBody}\nWAHA_ENGINE=WEBJS`,
      `${validEnvBody}\nOTHER_SETTING=value`,
    ];

    for (const body of invalidLines) {
      assert.throws(() => parseWahaEnvContent(body));
    }
    assert.match(
      parseWahaEnvContent(validEnvBody).WAHA_SWAGGER_PASSWORD,
      /^c{32}$/,
    );
  });

  test('preflight detects inherited Compose interpolation overrides by key only', () => {
    const overrides = findInheritedWahaOverrides({
      WAHA_ENGINE: 'secret-engine-value',
      WAHA_SWAGGER_PASSWORD: 'secret-password-value',
      UNRELATED_VALUE: 'ignored',
    });
    assert.deepEqual(overrides.sort(), ['WAHA_ENGINE', 'WAHA_SWAGGER_PASSWORD']);
    assert.doesNotMatch(overrides.join('\n'), /secret/);
  });

  test('webhook URL requires HTTPS, exact route and a sufficiently long HMAC key', () => {
    const noHmac = validateWahaConfig({
      ...validConfig,
      WAHA_WEBHOOK_URL: 'https://app.example.test/api/whatsapp/waha',
      WAHA_WEBHOOK_HMAC_KEY: 'short',
    });
    assert.ok(noHmac.some((error) => error.startsWith('WAHA_WEBHOOK_HMAC_KEY')));

    const wrongRoute = validateWahaConfig({
      ...validConfig,
      WAHA_WEBHOOK_URL: 'http://app.example.test/api/whatsapp/waha?token=secret',
    });
    assert.ok(wrongRoute.some((error) => error.startsWith('WAHA_WEBHOOK_URL')));
  });

  test('preflight rejects WHATWG hex-number final labels, including the zero-digit forms', () => {
    // E4 reviewer edge: a `+` quantifier accepted the final labels `0x`, `0X`,
    // `1.2.3.0x` and `example.0x`, which WHATWG reads as the number 0 or fails
    // outright — none of them is byte-identical in the canonical host.
    for (const host of ['example.0x', '0x', '1.2.3.0x', '0X', 'example.0x.']) {
      const errors = validateWahaConfig({
        ...validConfig,
        WAHA_WEBHOOK_URL: `https://${host}/api/whatsapp/waha`,
      });
      assert.ok(
        errors.some((error) => error.startsWith('WAHA_WEBHOOK_URL')),
        `host ${host} must be rejected`,
      );
    }
    // No overblocking: `0xapp` is a legal DNS label (p is not a hex digit).
    assert.deepEqual(validateWahaConfig({
      ...validConfig,
      WAHA_WEBHOOK_URL: 'https://0xapp.example.com/api/whatsapp/waha',
    }), []);
  });

  test('CLI reads a private synthetic env file without echoing secret values', () => {
    const file = writeEnv(validConfig);
    const result = spawnSync(process.execPath, [preflightPath, file], {
      encoding: 'utf8',
      timeout: 10_000,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /preflight passed/i);
    assert.doesNotMatch(result.stdout + result.stderr, /b{128}|c{32}|d{64}/);
  });

  test('target session volume remains out of the PostgreSQL backup script', () => {
    assert.doesNotMatch(backupScript, /waha|waha_sessions|\.sessions/i);
    assert.match(readme, /backup-synkroo\.sh/);
    assert.match(readme, /does not add the\s+session volume/i);
    assert.match(readme, /P3\.4/i);
  });

  test('preflight requires exactly 0600 on POSIX (0400/0700/group/other/special bits rejected)', () => {
    assert.equal(isPrivateFileMode(0o100600, 'linux'), true);
    for (const mode of [0o100400, 0o100700, 0o100640, 0o100644, 0o100600 | 0o111, 0o104600, 0o102600, 0o101600]) {
      assert.equal(isPrivateFileMode(mode, 'linux'), false, `mode ${mode.toString(8)} must fail`);
    }
    // Windows mode bits are emulated: documented no-op, user-private directory required instead.
    assert.equal(isPrivateFileMode(0o100644, 'win32'), true);
  });

  test('release test script includes this scaffold contract suite', () => {
    assert.match(packageJson.scripts['test:release'], /vps-waha-compose\.test\.mjs/);
  });
});
