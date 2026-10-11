import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { after, before, describe, test } from 'node:test';

/**
 * Contract for ops/vps/synkroo-prod-postgres/docker-compose.yml.
 *
 * Live drift was observed where the server accepted connections (pg_isready,
 * local socket, `trust` in pg_hba.conf) while an authenticated query over TLS
 * TCP would fail. The healthcheck therefore keeps pg_isready (server
 * acceptance) and adds a real SCRAM login: TLS TCP psql to 127.0.0.1 with
 * PGPASSWORD/PGSSLMODE from the container environment, `-w`, `SELECT 1`.
 *
 * Compose escaping contract: `$$` in the source becomes a literal `$` in the
 * runtime command, so the CONTAINER shell expands ${POSTGRES_*}. A bare `$$`
 * reaching the shell would expand to the PID (a number), silently producing a
 * bogus user/password literal — these tests pin both directions.
 */

const root = resolve(import.meta.dirname, '..', '..');
const composePath = resolve(root, 'ops/vps/synkroo-prod-postgres/docker-compose.yml');
const composeSource = readFileSync(composePath, 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

// Obviously synthetic values: used only to resolve the config locally and to
// drive a disposable PostgreSQL. They are never real credentials and must
// never appear in the healthcheck command (it must stay env-driven).
const SYNTHETIC_ENV = {
  POSTGRES_USER: 'synthetic-healthcheck-user',
  POSTGRES_PASSWORD: 'synthetic-healthcheck-password',
  POSTGRES_DB: 'synthetic-healthcheck-db',
  TUNNEL_TOKEN: 'synthetic-tunnel-token',
};
const WRONG_PASSWORD = 'synthetic-wrong-password-value';

const healthcheckLine = composeSource.split(/\r?\n/).find((line) => /^\s*test: \[/.test(line));
assert.ok(healthcheckLine, 'healthcheck test line must exist');

const RUN_TIMEOUT = 20_000;
/** Bounded poll (and one cleanup retry): tight, but never a broad loop. */
const ABSENT_POLL_TIMEOUT = 10_000;
const ABSENT_POLL_INTERVAL = 200;
const VOLUME_RETRY_DELAY = 1_000;

const NO_SUCH = /no such (object|container|volume)/i;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function dockerOutput(result) {
  const body = `${result.stderr ?? result.stdout ?? result.error?.message ?? ''}`.trim();
  return `${body} (status=${result.status}, signal=${result.signal})`;
}

function docker(args, options = {}) {
  return spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: options.timeout ?? RUN_TIMEOUT,
    ...options,
  });
}

function dockerDaemonAvailable() {
  return docker(['info'], { timeout: 15_000 }).status === 0;
}

const DOCKER_OK = dockerDaemonAvailable();

/** `docker compose config --format json` with a synthetic .env beside the file. */
function resolveComposeConfig() {
  const dir = mkdtempSync(join(tmpdir(), 'synkroo-hc-compose-'));
  try {
    const composeInDir = join(dir, 'docker-compose.yml');
    copyFileSync(composePath, composeInDir);
    const envInDir = join(dir, '.env');
    writeFileSync(
      envInDir,
      Object.entries(SYNTHETIC_ENV).map(([key, value]) => `${key}=${value}`).join('\n') + '\n',
      { encoding: 'utf8' },
    );
    const r = docker(
      [
        'compose',
        '--project-directory',
        dir,
        '-f',
        composeInDir,
        '--env-file',
        envInDir,
        'config',
        '--format',
        'json',
      ],
      { timeout: 60_000 },
    );
    assert.equal(r.status, 0, `docker compose config failed: ${r.stderr}`);
    assert.doesNotMatch(r.stderr, /variable is not set/i, 'compose interpolation must be fully provided');
    return JSON.parse(r.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The escaped form printed by `compose config`; `$$` means a literal `$`. */
function escapedHealthcheckCommand(config) {
  const command = config?.services?.postgres?.healthcheck?.test?.[1];
  assert.equal(typeof command, 'string', 'resolved healthcheck command must be a string');
  return command;
}

/** What the container shell actually receives: Compose unescapes `$$` → `$`. */
function runtimeHealthcheckCommand(escaped) {
  return escaped.replace(/\$\$/g, '$');
}

describe('prod-postgres compose healthcheck source contract', () => {
  test('healthcheck is CMD-SHELL, retains pg_isready and adds the authenticated TLS query', () => {
    assert.match(healthcheckLine, /^\s*test: \["CMD-SHELL",/);
    assert.match(
      healthcheckLine,
      /pg_isready -U \$\$\{POSTGRES_USER\} -d \$\$\{POSTGRES_DB\}/,
      'pg_isready invocation must be retained with escaped env references',
    );
    assert.match(healthcheckLine, /&& PGSSLMODE=require PGPASSWORD=\$\$\{POSTGRES_PASSWORD\}/);
    assert.match(
      healthcheckLine,
      /psql -h 127\.0\.0\.1 -p 5432 -U \$\$\{POSTGRES_USER\} -d \$\$\{POSTGRES_DB\} -w -tAc 'SELECT 1'/,
    );
  });

  test('every variable in the healthcheck is Compose-escaped ($$) — none is host-interpolated', () => {
    const dollars = (healthcheckLine.match(/\$\{/g) || []).length;
    const escapedDollars = (healthcheckLine.match(/\$\$\{/g) || []).length;
    assert.equal(dollars, escapedDollars, 'no bare ${...} may reach host-side interpolation');
    assert.equal(dollars, 5, 'POSTGRES_USER x2, POSTGRES_DB x2, POSTGRES_PASSWORD x1');
    assert.doesNotMatch(healthcheckLine, /\$\$\$\$/);
  });

  test('no credential literal is embedded; PGSSLMODE/PGPASSWORD come from the environment only', () => {
    assert.doesNotMatch(healthcheckLine, /PGPASSWORD=(?!\$\$\{)/, 'PGPASSWORD must reference the env, never a literal');
    assert.doesNotMatch(healthcheckLine, /PGSSLMODE=(?!require)/);
    assert.doesNotMatch(healthcheckLine, /password\s*[:=]\s*['"]?(?!\$\$)[^\s'"]{4,}/i);
  });

  test('host-side interpolation of the tunnel token is untouched', () => {
    assert.match(composeSource, /--token", "\$\{TUNNEL_TOKEN\}"\]/, 'cloudflared token stays host-interpolated');
  });

  test('release test script includes this contract suite', () => {
    assert.match(packageJson.scripts['test:release'], /vps-prod-postgres-healthcheck\.test\.mjs/);
  });
});

describe('resolved docker compose config (synthetic .env)', { skip: !DOCKER_OK }, () => {
  let config;
  let escaped;
  let runtime;

  before(() => {
    config = resolveComposeConfig();
    escaped = escapedHealthcheckCommand(config);
    runtime = runtimeHealthcheckCommand(escaped);
  });

  test('compose source is valid and resolves without warnings', () => {
    assert.equal(config?.services?.postgres?.healthcheck?.test?.[0], 'CMD-SHELL');
    assert.equal(escaped.includes('$$$$'), false, 'no double-escaped $$ may reach the shell');
  });

  test('runtime variable expansion is intact — env refs survive, no PID literal', () => {
    // Escaped output keeps the $$ form (round-trippable); the runtime string
    // must hold single-$ references the container shell can expand.
    assert.match(escaped, /\$\$\{POSTGRES_USER\}/);
    assert.equal(/(?<!\$)\$\{POSTGRES_USER\}/.test(escaped), false, 'config output must not carry a bare ${...}');
    assert.match(runtime, /\$\{POSTGRES_USER\}/);
    assert.match(runtime, /-d \$\{POSTGRES_DB\}/);
    assert.match(runtime, /PGPASSWORD=\$\{POSTGRES_PASSWORD\}/);
    // A literal `$$` in the runtime string would expand to the shell PID.
    assert.equal(runtime.includes('$$'), false, 'runtime command must not contain $$ (PID literal)');
  });

  test('resolved healthcheck contains pg_isready AND the authenticated psql SELECT 1', () => {
    assert.match(runtime, /^pg_isready -U \$\{POSTGRES_USER\} -d \$\{POSTGRES_DB\}/);
    assert.match(runtime, /PGSSLMODE=require PGPASSWORD=\$\{POSTGRES_PASSWORD\} psql -h 127\.0\.0\.1 -p 5432/);
    assert.match(runtime, /-w -tAc 'SELECT 1'$/);
  });

  test('synthetic secrets are never baked into the healthcheck command', () => {
    for (const value of Object.values(SYNTHETIC_ENV)) {
      assert.equal(escaped.includes(value), false, 'synthetic value leaked into the resolved healthcheck');
    }
  });

  test('interval/timeout/retries/start_period of the original check are unchanged', () => {
    const hc = config.services.postgres.healthcheck;
    assert.equal(hc.interval, '5s');
    assert.equal(hc.timeout, '5s');
    assert.equal(hc.retries, 12);
    assert.equal(hc.start_period, '10s');
  });
});

describe('disposable PostgreSQL proves the drift distinction', { skip: !DOCKER_OK }, () => {
  const suffix = `${process.pid.toString(36)}-${Date.now().toString(36)}`;
  const container = `synkroo-hc-probe-${suffix}`;
  const volume = `synkroo-hc-probe-data-${suffix}`;
  /** Disposable official image; the contract under test is auth/TLS, not pgvector. */
  const image = 'postgres:17';
  let runtime;

  const execIn = (args, extraEnv = []) =>
    docker(['exec', ...extraEnv, container, ...args], { timeout: 60_000 });

  const waitDatabase = () => {
    // pg_isready only proves the server answers; the official entrypoint can
    // still be mid-init (user created by initdb, database created after).
    // Poll a local-socket (trust) query until the database really exists.
    for (let i = 0; i < 120; i += 1) {
      const r = docker([
        'exec', container, 'sh', '-c',
        'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1"',
      ]);
      if (r.status === 0) return;
      sleepSync(1000);
    }
    throw new Error('disposable postgres did not finish initializing');
  };

  /**
   * Deterministic teardown of the disposable container. An unchecked
   * `docker rm -f` is the flake QA measured: the CLI can report success while
   * the daemon still holds the name (and a kill of the CLI — timeout or signal
   * — is not a completed removal), so the phase-2 `docker run --name` races a
   * "name already in use" conflict. Fail closed: assert the remove really
   * terminated, then poll the daemon until the name is provably absent.
   * CLI timeouts stay at RUN_TIMEOUT (what this file already used) so a slow
   * daemon is waited for instead of being killed.
   */
  function removeContainerAndWait() {
    const r = docker(['rm', '-f', container]);
    assert.ok(
      r.status === 0 || NO_SUCH.test(r.stderr ?? ''),
      `docker rm -f ${container} did not complete cleanly: ${dockerOutput(r)}`,
    );
    const deadline = Date.now() + ABSENT_POLL_TIMEOUT;
    for (;;) {
      const inspect = docker(['container', 'inspect', container]);
      if (inspect.status !== 0) {
        assert.ok(
          NO_SUCH.test(inspect.stderr ?? ''),
          `docker container inspect ${container} failed unexpectedly: ${dockerOutput(inspect)}`,
        );
        return; // name is absent: safe to reuse
      }
      assert.ok(
        Date.now() < deadline,
        `container ${container} still present ${ABSENT_POLL_TIMEOUT}ms after docker rm -f`,
      );
      sleepSync(ABSENT_POLL_INTERVAL);
    }
  }

  /**
   * The volume name is unique to this run, so it is always safe to reclaim.
   * One bounded retry covers the daemon lag where removal is accepted but the
   * volume is briefly still mounted/finalizing.
   */
  function removeVolumeAndWait() {
    for (let attempt = 0; ; attempt += 1) {
      const r = docker(['volume', 'rm', volume]);
      if (r.status === 0 || NO_SUCH.test(r.stderr ?? '')) return;
      assert.ok(attempt < 1, `docker volume rm ${volume} failed: ${dockerOutput(r)}`);
      sleepSync(VOLUME_RETRY_DELAY);
    }
  }

  before(() => {
    runtime = runtimeHealthcheckCommand(escapedHealthcheckCommand(resolveComposeConfig()));

    // Phase 1: initialize the cluster with the synthetic credentials.
    let r = docker([
      'run', '-d', '--name', container, '-v', `${volume}:/var/lib/postgresql/data`,
      '-e', `POSTGRES_USER=${SYNTHETIC_ENV.POSTGRES_USER}`,
      '-e', `POSTGRES_PASSWORD=${SYNTHETIC_ENV.POSTGRES_PASSWORD}`,
      '-e', `POSTGRES_DB=${SYNTHETIC_ENV.POSTGRES_DB}`,
      image,
    ]);
    assert.equal(r.status, 0, `container start failed: ${r.stderr}`);
    waitDatabase();

    // Self-signed TLS material inside the data volume (root-owned 0600 key is
    // accepted by the server; generated in-container to dodge bind-mount perms).
    r = execIn([
      'sh', '-c',
      'mkdir -p "$PGDATA/ssl" && openssl req -new -x509 -days 1 -nodes -subj "/CN=synkroo-healthcheck-test" -out "$PGDATA/ssl/server.crt" -keyout "$PGDATA/ssl/server.key" 2>/dev/null && chmod 600 "$PGDATA/ssl/server.key" "$PGDATA/ssl/server.crt" && chown postgres:postgres "$PGDATA/ssl/server.key" "$PGDATA/ssl/server.crt"',
    ]);
    assert.equal(r.status, 0, `certificate generation failed: ${r.stderr}`);

    // Mirror the production pg_hba shape: local socket trust, TCP TLS+SCRAM.
    r = execIn([
      'sh', '-c',
      [
        'cat > "$PGDATA/pg_hba.conf" <<EOF',
        'local   all             all                                     trust',
        'hostssl all             all             127.0.0.1/32            scram-sha-256',
        'hostssl all             all             ::1/128                 scram-sha-256',
        'local   replication     all                                     trust',
        'hostssl replication     all             127.0.0.1/32            scram-sha-256',
        'hostssl replication     all             ::1/128                 scram-sha-256',
        'EOF',
      ].join('\n'),
    ]);
    assert.equal(r.status, 0, `pg_hba rewrite failed: ${r.stderr}`);

    // Deterministic teardown before the name is reused: prove the daemon
    // released it, so phase 2 cannot hit "name already in use".
    removeContainerAndWait();

    // Phase 2: fresh start with TLS on (data exists, so no initdb runs).
    r = docker([
      'run', '-d', '--name', container, '-v', `${volume}:/var/lib/postgresql/data`,
      '-e', `POSTGRES_USER=${SYNTHETIC_ENV.POSTGRES_USER}`,
      '-e', `POSTGRES_PASSWORD=${SYNTHETIC_ENV.POSTGRES_PASSWORD}`,
      '-e', `POSTGRES_DB=${SYNTHETIC_ENV.POSTGRES_DB}`,
      image, 'postgres', '-c', 'ssl=on',
      '-c', 'ssl_cert_file=/var/lib/postgresql/data/ssl/server.crt',
      '-c', 'ssl_key_file=/var/lib/postgresql/data/ssl/server.key',
    ]);
    assert.equal(r.status, 0, `TLS restart failed: ${r.stderr}`);
    waitDatabase();
  });

  after(() => {
    // Runs even when `before` failed midway (setup error, init timeout, ...).
    // Collect instead of throw-on-first: every resource gets one attempt and
    // the aggregate error is clearly attributed to cleanup, so it cannot be
    // mistaken for (nor mask) the primary test failure above it.
    const problems = [];
    try {
      removeContainerAndWait();
    } catch (err) {
      problems.push(`container: ${err.message}`);
    }
    try {
      removeVolumeAndWait();
    } catch (err) {
      problems.push(`volume: ${err.message}`);
    }
    if (problems.length > 0) {
      throw new Error(`disposable postgres cleanup failed (test-created resources leaked): ${problems.join(' | ')}`);
    }
  });

  test('server actually serves TLS (the psql path is encrypted)', () => {
    const r = execIn([
      'sh', '-c',
      'PGPASSWORD="$POSTGRES_PASSWORD" psql "host=127.0.0.1 user=$POSTGRES_USER dbname=$POSTGRES_DB sslmode=require" -tAc "SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()"',
    ]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), 't');
  });

  test('full healthcheck command passes with correct credentials and outputs exactly the result', () => {
    const r = execIn(['sh', '-c', runtime]);
    assert.equal(r.status, 0, `healthcheck must pass: ${r.stderr}`);
    const lines = r.stdout.trimEnd().split('\n');
    assert.equal(lines[lines.length - 1], '1', `psql -tA must emit exactly the query result: ${JSON.stringify(r.stdout)}`);
  });

  test('wrong credentials fail the full check while pg_isready alone still passes (the drift)', () => {
    const full = execIn(['sh', '-c', runtime], ['-e', `POSTGRES_PASSWORD=${WRONG_PASSWORD}`]);
    assert.notEqual(full.status, 0, 'authenticated query must fail with wrong credentials');
    assert.match(full.stderr, /password authentication failed/);

    // Exactly the live failure mode: server acceptance is NOT proof of auth.
    const readyOnly = execIn(
      ['sh', '-c', 'pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}'],
      ['-e', `POSTGRES_PASSWORD=${WRONG_PASSWORD}`],
    );
    assert.equal(readyOnly.status, 0, 'pg_isready alone keeps passing — proving the gap');
  });

  test('a missing password fails the full check instead of silently passing', () => {
    const r = execIn(['sh', '-c', runtime], ['-e', 'POSTGRES_PASSWORD=']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /no password supplied|password authentication failed/);
  });

  test('non-TLS TCP is refused by the hostssl rule (encryption is mandatory)', () => {
    const r = execIn([
      'sh', '-c',
      `PGSSLMODE=disable PGPASSWORD=${SYNTHETIC_ENV.POSTGRES_PASSWORD} psql -h 127.0.0.1 -p 5432 -U ${SYNTHETIC_ENV.POSTGRES_USER} -d ${SYNTHETIC_ENV.POSTGRES_DB} -w -tAc 'SELECT 1'`,
    ]);
    assert.notEqual(r.status, 0, 'sslmode=disable must be rejected by pg_hba');
  });
});
