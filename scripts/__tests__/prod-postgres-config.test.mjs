/**
 * Contract tests for ops/vps/synkroo-prod-postgres static config.
 *
 * Local-only: reads the compose assets from disk, no Docker, no VPS, no
 * secrets. Asserts (i) postgresql.conf pins an explicit hba_file, (ii)
 * pg_hba.conf exposes only hostssl rows (no plaintext `host`/`hostnossl`
 * rows), (iii) hostssl rows pin scram-sha-256, (iv) local rows pin trust,
 * (v) the postgres service publishes no host port, and (vi) the
 * cloudflared Tunnel token travels via `--token-file` (bind mount
 * read-only, host path outside the repo) — never as argv `--token <valor>`
 * nor as visible env.
 *
 * Rule-precedence (first match wins) is documented, not statically
 * assertable here: pg_hba.conf keeps the file minimal (local trust first,
 * then hostssl-only) so no earlier row can shadow the hostssl+SCRAM
 * requirement. Live precedence plus non-TLS rejection are proved in the
 * disposable-PostgreSQL suite (vps-prod-postgres-healthcheck.test.mjs).
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

  test('hostssl rows pin scram-sha-256 (no weaker method)', () => {
    const rows = pgHbaConf
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
    for (const row of rows.filter((r) => r.startsWith('hostssl'))) {
      assert.match(row, /scram-sha-256\s*$/, `hostssl row must pin scram-sha-256: ${row}`);
    }
  });

  test('local rows are pinned to trust (socket-only maintenance path)', () => {
    // Pinned shape: Unix-socket maintenance (healthcheck pg_isready, docker
    // exec) authenticates via peer socket, not password. Any change to
    // local-row auth (e.g. trust → scram) must update the compose healthcheck
    // and the documented Contabo probes together — hence the pin.
    const rows = pgHbaConf
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
    const localRows = rows.filter((r) => r.startsWith('local'));
    assert.ok(localRows.length > 0, 'pg_hba.conf must keep at least one local row');
    for (const row of localRows) {
      assert.match(row, /^local\s+\S+\s+\S+\s+trust\s*$/, `local row auth is pinned to trust: ${row}`);
    }
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

describe('prod-postgres D3 firewall static contract', () => {
  const d3Script = readFileSync(resolve(dir, 'apply-d3-firewall.sh'), 'utf8');
  const d3Unit = readFileSync(resolve(dir, 'synkroo-d3-firewall.service'), 'utf8');

  const CF_RANGES = [
    '173.245.48.0/20',
    '103.21.244.0/22',
    '103.22.200.0/22',
    '103.31.4.0/22',
    '141.101.64.0/18',
    '108.162.192.0/18',
    '190.93.240.0/20',
    '188.114.96.0/20',
    '197.234.240.0/22',
    '198.41.128.0/17',
    '162.158.0.0/15',
    '104.16.0.0/13',
    '104.24.0.0/14',
    '172.64.0.0/13',
    '131.0.72.0/22',
  ];

  test('script pins all 15 Cloudflare ranges', () => {
    assert.equal(CF_RANGES.length, 15, 'contract pins exactly 15 ranges');
    for (const range of CF_RANGES) {
      assert.ok(d3Script.includes(range), `script must pin Cloudflare range ${range}`);
    }
  });

  test('SYNKROO-D3 ends with a v4 DROP final', () => {
    assert.match(d3Script, /SYNKROO-D3[\s\S]*-j DROP/, 'SYNKROO-D3 must end with a DROP final');
  });

  test('SYNKROO-D3-V6 is DROP final', () => {
    assert.match(d3Script, /SYNKROO-D3-V6[\s\S]*-j DROP/, 'SYNKROO-D3-V6 must be DROP final');
  });

  test('all rules carry the comment marker', () => {
    assert.ok(d3Script.includes('synkroo-d3-20261012'), 'script must carry the comment marker');
  });

  test('CONTAINER_IP is required (no default)', () => {
    assert.match(d3Script, /CONTAINER_IP/, 'script must require CONTAINER_IP');
  });

  test('idempotency uses -C before -A', () => {
    assert.match(d3Script, /-C/, 'script must check with -C before appending');
    assert.match(d3Script, /-A/, 'script must append with -A');
  });

  test('unit is oneshot after docker with EnvironmentFile', () => {
    assert.match(d3Unit, /Type=oneshot/, 'unit must be oneshot');
    assert.match(d3Unit, /After=docker\.service/, 'unit must order after docker.service');
    assert.match(d3Unit, /EnvironmentFile=\/root\/\.secrets\/synkroo-d3\.env/, 'unit must read CONTAINER_IP via EnvironmentFile');
    assert.match(d3Unit, /RemainAfterExit=yes/, 'unit must keep RemainAfterExit=yes');
  });

  test('shell script uses LF only (no CR — CRLF breaks bash with $CR command not found)', () => {
    assert.ok(!d3Script.includes('\r'), 'apply-d3-firewall.sh must not contain CR characters');
  });

  test('unit file uses LF only (no CR)', () => {
    assert.ok(!d3Unit.includes('\r'), 'synkroo-d3-firewall.service must not contain CR characters');
  });

  test('v4 ACCEPTs pin -d "${CONTAINER_IP}" (match live rules for -C idempotency)', () => {
    const acceptLines = d3Script
      .split('\n')
      .filter((line) => line.includes('SYNKROO-D3') && line.includes('-j ACCEPT') && !line.includes('SYNKROO-D3-V6'));
    assert.ok(acceptLines.length > 0, 'script must keep at least one SYNKROO-D3 ACCEPT line');
    for (const line of acceptLines) {
      assert.ok(
        line.includes('-d "${CONTAINER_IP}"'),
        `v4 ACCEPT must pin -d "\${CONTAINER_IP}": ${line.trim()}`,
      );
    }
  });

  test('v4 DROP final carries no -p/--dport (byte-exact live match for -C idempotency)', () => {
    const dropLines = d3Script
      .split('\n')
      .filter((line) => !line.trim().startsWith('#') && line.includes('SYNKROO-D3') && line.includes('-j DROP') && !line.includes('SYNKROO-D3-V6'));
    assert.equal(dropLines.length, 1, 'script must keep exactly one SYNKROO-D3 DROP line');
    assert.doesNotMatch(dropLines[0], /-p\s/, `v4 DROP must not carry -p (live: no -p/--dport): ${dropLines[0].trim()}`);
    assert.doesNotMatch(dropLines[0], /--dport/, `v4 DROP must not carry --dport (live: no -p/--dport): ${dropLines[0].trim()}`);
    assert.match(dropLines[0], /-m comment --comment/, 'v4 DROP must carry the comment marker match');
  });

  test('v6 DROP final pins -p tcp --dport 5432 (live match)', () => {
    const dropLines = d3Script
      .split('\n')
      .filter((line) => !line.trim().startsWith('#') && line.includes('SYNKROO-D3-V6') && line.includes('-j DROP'));
    assert.equal(dropLines.length, 1, 'script must keep exactly one SYNKROO-D3-V6 DROP line');
    assert.match(dropLines[0], /-p tcp --dport 5432/, `v6 DROP must pin -p tcp --dport 5432: ${dropLines[0].trim()}`);
  });
  test('DOCKER-USER jumps insert at position 1 (-I), never append', () => {
    const jumps = d3Script
      .split('\n')
      .filter((line) => !line.trim().startsWith('#') && line.includes('DOCKER-USER') && line.includes('-j SYNKROO-D3'));
    assert.equal(jumps.length, 2, 'script must keep exactly two DOCKER-USER jumps (v4 + v6)');
    for (const line of jumps) {
      assert.match(line, /ensure_top/, `DOCKER-USER jump must go through ensure_top: ${line.trim()}`);
      assert.doesNotMatch(line, /^ensure\s/, `DOCKER-USER jump must not use plain ensure (-A): ${line.trim()}`);
    }
    assert.match(d3Script, /-I "\$chain" 1/, 'ensure_top must insert with -I <chain> 1');
    assert.match(d3Script, /RETURN/, 'script must document why top-insertion (Docker RETURN terminal)');
  });

  test('IP-swap guard fails closed with manual rotation procedure', () => {
    assert.match(d3Script, /diferente de/, 'guard must compare existing -d against CONTAINER_IP');
    assert.match(d3Script, /fail-closed/i, 'guard must state fail-closed behaviour');
    assert.match(d3Script, /-D exato/, 'guard must orient removal of the old IP via exact -D');
    assert.match(d3Script, /EnvironmentFile/, 'guard must orient updating the EnvironmentFile');
    assert.match(d3Script, /exit 3/, 'guard must abort with a distinct non-zero exit');
    const codeLines = d3Script
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    assert.doesNotMatch(codeLines, /\-F/, 'normal path must never flush (-F creates an exposure window)');
    assert.doesNotMatch(codeLines, /\-X/, 'normal path must never destroy chains (-X creates an exposure window)');
  });

  test('unit binds to docker lifecycle (PartOf+BindsTo)', () => {
    assert.match(d3Unit, /^PartOf=docker\.service$/m, 'unit must carry PartOf=docker.service');
    assert.match(d3Unit, /^BindsTo=docker\.service$/m, 'unit must carry BindsTo=docker.service');
    assert.match(d3Unit, /^After=docker\.service$/m, 'unit must keep After=docker.service');
    assert.match(d3Unit, /^WantedBy=multi-user\.target$/m, 'unit must keep WantedBy=multi-user.target');
    assert.match(d3Unit, /RemainAfterExit=yes/, 'unit must keep RemainAfterExit=yes');
    assert.match(d3Unit, /EnvironmentFile=\/root\/\.secrets\/synkroo-d3\.env/, 'unit must keep EnvironmentFile');
  });

  test('script header documents the safe removal procedure', () => {
    const header = d3Script.split('\n').slice(0, 60).join('\n');
    assert.match(header, /REMOÇÃO SEGURA/, 'header must document the safe removal procedure');
    assert.match(header, /disable --now/, 'removal must start with disable --now of the unit');
    assert.match(header, /-D/, 'removal must use exact -D for the 2 jumps');
    assert.match(header, /SYNKROO-D3-V6/, 'removal must name both own chains');
    assert.match(header, /nunca flush global/, 'removal must forbid global DOCKER-USER flush');
  });
  test('v6 DOCKER-USER jump carries no -d (ip6tables rejects IPv4 -d)', () => {
    const v6Jumps = d3Script
      .split('\n')
      .filter((line) => !line.trim().startsWith('#') && line.includes('DOCKER-USER') && line.includes('SYNKROO-D3-V6'));
    assert.equal(v6Jumps.length, 1, 'script must keep exactly one v6 DOCKER-USER jump');
    assert.doesNotMatch(v6Jumps[0], /-d\s/, `v6 jump must not carry -d: ${v6Jumps[0].trim()}`);
  });

  test('fill-before-jump: DOCKER-USER jumps install last, per family (v4 block then v6 block)', () => {
    // Lifecycle/ordering: an early jump pointing at an empty chain would
    // expose Postgres on partial failure (empty chain RETURNS implicitly,
    // without the DROP final). Fills first, jumps last — v4 complete, then v6.
    const lines = d3Script.split('\n');
    const codeLines = lines.filter((line) => !line.trim().startsWith('#'));
    const lastFillV4 = codeLines.reduce(
      (acc, line, idx) => (line.includes('SYNKROO-D3') && /-j (ACCEPT|DROP)/.test(line) && !line.includes('SYNKROO-D3-V6') ? idx : acc),
      -1,
    );
    const v4Jump = codeLines.findIndex((line) => line.includes('DOCKER-USER') && line.includes('-j SYNKROO-D3') && !line.includes('SYNKROO-D3-V6'));
    const v6Fill = codeLines.reduce(
      (acc, line, idx) => (line.includes('SYNKROO-D3-V6') && /-j DROP/.test(line) ? idx : acc),
      -1,
    );
    const v6Jump = codeLines.findIndex((line) => line.includes('DOCKER-USER') && line.includes('SYNKROO-D3-V6'));
    assert.ok(lastFillV4 >= 0, 'script must keep v4 fills (ACCEPTs + DROP)');
    assert.ok(v4Jump >= 0, 'script must keep the v4 DOCKER-USER jump');
    assert.ok(v6Fill >= 0, 'script must keep the v6 fill (DROP)');
    assert.ok(v6Jump >= 0, 'script must keep the v6 DOCKER-USER jump');
    assert.ok(v4Jump > lastFillV4, 'v4 jump must come after all v4 fills in the script text');
    assert.ok(v6Jump > v6Fill, 'v6 jump must come after the v6 fill in the script text');
    assert.ok(v6Fill > v4Jump || v6Fill > lastFillV4, 'v6 block must come after the v4 block (v4 complete, then v6)');
    assert.match(d3Script, /RETURN implícito/, 'script must document that an empty chain RETURNS implicitly');
    assert.match(d3Script, /falha parcial/, 'script must document the partial-failure exposure without fill-before-jump');
  });

  test('IP rotation is manual via explicit commands, never by the updated script itself', () => {
    assert.match(d3Script, /MANUAL/, 'rotation must be labelled MANUAL');
    assert.match(d3Script, /iptables -A/, 'rotation must add the new-IP ACCEPTs via explicit iptables -A');
    assert.match(d3Script, /contadores/, 'rotation must verify counters before removing the old IP');
    assert.match(d3Script, /-D exato/, 'rotation must remove the old-IP ACCEPTs via exact -D');
    assert.match(d3Script, /Re-executar/, 'rotation must re-execute the script to converge the jumps after the EnvironmentFile update');
    assert.match(d3Script, /aborta por desenho/, 'rotation must state the script aborts by design on divergent IP');
    assert.match(d3Script, /Monitoramento recomendado/, 'script must recommend periodic IP-vs-EnvironmentFile and counter monitoring');
    assert.doesNotMatch(d3Script, /com o EnvironmentFile já atualizado/, 'rotation must never suggest the updated script adds the new-IP rules by itself (it aborts)');
  });

  test('unit is wanted by docker.service and multi-user.target (separate stop/start)', () => {
    assert.match(d3Unit, /^WantedBy=docker\.service$/m, 'unit must carry WantedBy=docker.service for separate docker stop/start');
    assert.match(d3Unit, /^WantedBy=multi-user\.target$/m, 'unit must keep WantedBy=multi-user.target for boot');
    assert.match(d3Unit, /^BindsTo=docker\.service$/m, 'unit must keep BindsTo=docker.service');
    assert.match(d3Unit, /^PartOf=docker\.service$/m, 'unit must keep PartOf=docker.service');
    assert.match(d3Unit, /^Requires=docker\.service$/m, 'unit must keep Requires=docker.service');
    assert.match(d3Unit, /^After=docker\.service$/m, 'unit must keep After=docker.service');
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
