/**
 * scripts/__tests__/contabo-backup-synkroo.test.mjs
 *
 * Contract tests for ops/vps/contabo/backup/backup-synkroo.sh (Contabo daily
 * backup). Local-only: no VPS, no Docker daemon, no rclone remote, no
 * healthchecks.io endpoint and no production artifact is ever touched. The
 * real script is executed inside a synthetic harness where only the
 * host-facing commands (sudo/docker/rclone/curl) are replaced by recording
 * shell functions; exit code, traps, logs and pings remain the script's own.
 *
 * Regression coverage for the E2a incident:
 *   1. the SHA-256 manifest must use RELATIVE member names and must travel
 *      INSIDE the tar archive (the tar is the only artifact moved off-host),
 *      with an identical adjacent copy for local pre-move verification;
 *   2. missing rclone config, missing rclone binary or a failed `rclone move`
 *      must FAIL the backup (nonzero exit, FALHOU logged, /fail ping, local
 *      archive preserved) and must NEVER emit the success ping nor log
 *      "backup concluido".
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, test } from 'node:test';

const root = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const scriptPath = join(root, 'ops', 'vps', 'contabo', 'backup', 'backup-synkroo.sh');
const source = readFileSync(scriptPath, 'utf8');

const PING_URL = 'https://hc.invalid/synkroo-e2a-synthetic-uuid';
const created = [];
after(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

// ─── Runner detection (native bash, or Git Bash on Windows) ──────────────────

function detectRunner() {
  if (process.platform !== 'win32') {
    const probe = spawnSync('bash', ['-c', 'command -v flock sha256sum tar mktemp find'], { encoding: 'utf8' });
    return probe.status === 0 ? { kind: 'native', bash: 'bash' } : null;
  }
  const candidates = [
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe'),
  ];
  if (process.env.LOCALAPPDATA) {
    candidates.push(join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe'));
  }
  for (const bash of candidates) {
    if (!existsSync(bash)) continue;
    // MSYS/Git Bash only: `$MSYSTEM` distinguishes it from WSL bash.exe.
    const probe = spawnSync(bash, ['-c', 'test -n "$MSYSTEM" && command -v sha256sum tar mktemp find'], { encoding: 'utf8' });
    if (probe.status === 0) return { kind: 'gitbash', bash };
  }
  return null;
}

const runner = detectRunner();
const runtimeDescribe = runner
  ? describe
  : (name, fn) => describe(name, { skip: 'shell/bash indisponível neste host — cobertura estática continua aplicando' }, fn);

/** POSIX form of a path as seen by the runner. */
function toRuntimePath(winPath) {
  if (runner.kind === 'native') return winPath.split('\\').join('/');
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(winPath);
  return m ? `/${m[1].toLowerCase()}/${m[2].split('\\').join('/')}` : winPath;
}

// ─── Harness: wrapper sintético executando o script real ─────────────────────

function buildWrapper() {
  return `#!/bin/bash
# Gerado por contabo-backup-synkroo.test.mjs — NÃO editar à mão.
# Substitui apenas comandos que tocam o hospedeiro; o script real roda via
# \`source\`, então exit code, trap ERR, logs e pings são os do script.
set -u

# flock ausente em MSYS/Git Bash: o lock não é objeto deste teste.
if ! command -v flock >/dev/null 2>&1; then
  flock() { return 0; }
fi

# sudo nunca é exercido de verdade (o harness roda como o próprio usuário).
sudo() { "$@"; }

docker() {
  echo "docker $*" >> "$FAKE_DOCKER_LOG"
  case "\${3:-}" in
    pg_dump)
      db=""
      prev=""
      for a in "$@"; do [ "$prev" = "-d" ] && db="$a"; prev="$a"; done
      printf 'PGDUMP-SYNTHETIC db=%s\\n' "$db"
      head -c 512 /dev/zero | tr '\\0' 'D'
      ;;
    psql)
      # Probe de existência da staging: controlável por FAKE_STAGING.
      [ "\${FAKE_STAGING:-1}" = "1" ] && echo 1
      return 0
      ;;
    *)
      echo "fake-docker: subcomando inesperado: $*" >&2
      return 2
      ;;
  esac
}

curl() {
  # Registrar o ping e NUNCA tocar a rede.
  for a in "$@"; do
    case "$a" in
      https://*|http://*) echo "$a" >> "$FAKE_CURL_LOG" ;;
    esac
  done
  return 0
}

if [ "\${FAKE_RCLONE_PRESENT:-1}" = "1" ]; then
  rclone() {
    echo "rclone $*" >> "$FAKE_RCLONE_LOG"
    if [ "\${FAKE_RCLONE_MODE:-ok}" = "fail" ]; then
      echo "fake-rclone: falha sintética de move" >> "$FAKE_RCLONE_LOG"
      return 1
    fi
    # move sintético: copia para o destino local e remove a origem (sem rede).
    mkdir -p "$FAKE_RCLONE_DEST"
    cp -p "$2" "$FAKE_RCLONE_DEST/$(basename "$2")"
    rm -f "$2"
    return 0
  }
else
  # Simula binário ausente de forma determinística (command -v rclone -> 1).
  command() {
    if [ "\${1:-}" = "-v" ] && [ "\${2:-}" = "rclone" ]; then return 1; fi
    builtin command "$@"
  }
fi

. "$SYNKROO_BACKUP_SCRIPT"
`;
}

/** Executa o script real num harness sintético e devolve os caminhos Windows. */
function runScenario({ staging = true, rcloneConfig = true, rclonePresent = true, rcloneMode = 'ok' }) {
  const dir = mkdtempSync(join(tmpdir(), 'synkroo-contabo-backup-'));
  created.push(dir);
  writeFileSync(join(dir, '.env'), `BACKUP_HC_PING_URL=${PING_URL}\n`);
  if (rcloneConfig) {
    writeFileSync(join(dir, 'rclone.conf'), '[gdrive]\ntype = drive\nscope = drive\n# synthetic — sem credencial real\n');
  }
  mkdirSync(join(dir, 'conf', 'synkroo-prod-postgres'), { recursive: true });
  writeFileSync(join(dir, 'conf', 'synkroo-prod-postgres', '.env'), 'SYNTHETIC_CONFIG=1\n');
  writeFileSync(join(dir, 'wrapper.sh'), buildWrapper());

  const env = {
    ...process.env,
    SYNKROO_BACKUP_SCRIPT: toRuntimePath(scriptPath),
    SCRIPT_DIR: toRuntimePath(dir),
    BACKUP_DIR: toRuntimePath(join(dir, 'backups')),
    CONF_DIR: toRuntimePath(join(dir, 'conf', 'synkroo-prod-postgres')),
    FAKE_CURL_LOG: toRuntimePath(join(dir, 'curl.log')),
    FAKE_DOCKER_LOG: toRuntimePath(join(dir, 'docker.log')),
    FAKE_RCLONE_LOG: toRuntimePath(join(dir, 'rclone.log')),
    FAKE_RCLONE_DEST: toRuntimePath(join(dir, 'rclone-dest')),
    FAKE_RCLONE_PRESENT: rclonePresent ? '1' : '0',
    FAKE_RCLONE_MODE: rcloneMode,
    FAKE_STAGING: staging ? '1' : '0',
  };
  const r = spawnSync(runner.bash, [join(dir, 'wrapper.sh')], { encoding: 'utf8', env, timeout: 120_000 });
  return { dir, status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// ─── Helpers de leitura/verificação ──────────────────────────────────────────

const readOr = (dir, name) => {
  const p = join(dir, name);
  return existsSync(p) && statSync(p).isFile() ? readFileSync(p, 'utf8') : '';
};
const readBackupLog = (dir) => readOr(join(dir, 'backups'), 'backup.log');
const pingLines = (dir) => readOr(dir, 'curl.log').split('\n').filter(Boolean);
const listDir = (dir, name) => {
  const p = join(dir, name);
  return existsSync(p) ? readdirSync(p) : [];
};

function bash(cmd) {
  return spawnSync(runner.bash, ['-c', cmd], { encoding: 'utf8', timeout: 120_000 });
}
function tarMembers(tarWinPath) {
  const r = bash(`tar -tzf '${toRuntimePath(tarWinPath)}' | sort`);
  assert.equal(r.status, 0, `tar -tzf falhou: ${r.stderr}`);
  return r.stdout.split('\n').filter(Boolean);
}

function parseManifest(text) {
  const entries = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const m = /^([0-9a-f]{64})[ \t]+\*?(.+)$/.exec(line);
    assert.ok(m, `linha de manifest inválida: ${line}`);
    entries.push({ sha256: m[1], path: m[2] });
  }
  return entries;
}

/**
 * Contrato do manifest portátil sobre um tar produzido pelo harness:
 * cópia adjacente existe; manifest viaja dentro do tar; nomes são relativos;
 * nada de caminho absoluto/ temporário; manifest não se auto-hasheia; todo
 * arquivo hasheado é membro do tar; sha256sum -c passa no diretório extraído.
 */
function assertPortableManifest(dir, tarWinPath) {
  const backups = listDir(dir, 'backups');
  const manifestName = backups.find((f) => /^manifest-.*\.sha256$/.test(f));
  assert.ok(manifestName, 'cópia adjacente do manifest em backups/');

  const members = tarMembers(tarWinPath);
  assert.ok(
    members.includes(`./${manifestName}`),
    `manifest deve viajar dentro do tar: ${members.join(' ')}`,
  );

  const verifyDir = join(dir, 'verify');
  mkdirSync(verifyDir, { recursive: true });
  const x = bash(`tar -xzf '${toRuntimePath(tarWinPath)}' -C '${toRuntimePath(verifyDir)}'`);
  assert.equal(x.status, 0, `tar -xzf falhou: ${x.stderr}`);

  const adjacent = readFileSync(join(dir, 'backups', manifestName), 'utf8');
  const inside = readFileSync(join(verifyDir, manifestName), 'utf8');
  assert.equal(inside, adjacent, 'manifest adjacente deve ser idêntico ao do archive');

  const entries = parseManifest(inside);
  assert.ok(entries.length >= 2, `manifest deve cobrir configs + dumps: ${entries.length} entradas`);
  for (const { path: p } of entries) {
    assert.ok(p.startsWith('./'), `nome de membro relativo: ${p}`);
    assert.ok(!p.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(p), `sem caminho absoluto: ${p}`);
    assert.ok(!p.includes('/tmp'), `sem path temporário do host: ${p}`);
    assert.ok(!p.includes(manifestName), 'manifest não pode se auto-hasheia');
    assert.ok(members.includes(p), `arquivo hasheado é membro do tar: ${p}`);
  }
  assert.ok(
    entries.some((e) => e.path.endsWith('synkroo-configs.tar.gz')),
    'configs hasheados no manifest',
  );
  assert.ok(
    entries.some((e) => e.path.endsWith('.dump')),
    'dump lógico hasheado no manifest',
  );

  const chk = bash(`cd '${toRuntimePath(verifyDir)}' && sha256sum -c '${manifestName}'`);
  assert.equal(chk.status, 0, `sha256sum -c falhou no archive extraído: ${chk.stdout}${chk.stderr}`);
  assert.match(chk.stdout, /OK/);
}

/** Impede que um caminho de sucesso emita ping de sucesso ou log "concluido". */
function assertFailureEmittedNoSuccess(dir, expectLog, status) {
  assert.equal(status, 1, `falha deve encerrar com código 1: status=${status}`);
  assert.match(expectLog, /FALHOU: /, 'a falha precisa ser registrada no log');
  assert.ok(
    !expectLog.includes('backup concluido'),
    'falha nunca pode registrar "backup concluido"',
  );
  const pings = pingLines(dir);
  assert.deepEqual(pings, [`${PING_URL}/fail`], 'falha pinga /fail e nunca o ping de sucesso');
  // O archive local fica preservado para nova tentativa de off-host.
  const backups = listDir(dir, 'backups');
  const tar = backups.find((f) => /^synkroo-backup-.*\.tar\.gz$/.test(f));
  assert.ok(tar, 'falha preserva o archive local');
  assert.ok(
    backups.some((f) => /^manifest-.*\.sha256$/.test(f)),
    'falha preserva a cópia adjacente do manifest',
  );
  return join(dir, 'backups', tar);
}

// ─── Contrato estático (roda em qualquer host, sem shell) ────────────────────

describe('contrato estático do manifest/falha off-host', () => {
  test('defaults de produção permanecem intactos (override é só do harness)', () => {
    assert.ok(source.includes('BACKUP_DIR="${BACKUP_DIR:-/var/backups/synkroo}"'));
    assert.ok(source.includes('CONF_DIR="${CONF_DIR:-/opt/synkroo/synkroo-prod-postgres}"'));
    assert.ok(source.includes('SCRIPT_DIR="${SCRIPT_DIR:-/opt/synkroo/backup}"'));
    assert.ok(source.includes('LOCKFILE="$BACKUP_DIR/.backup.lock"'));
    assert.ok(source.includes('-C "$(dirname "$CONF_DIR")" "$(basename "$CONF_DIR")"'));
  });

  test('manifest é relativo, nasce em WORK antes do tar e tem cópia adjacente', () => {
    assert.ok(
      source.includes('(cd "$WORK" && sha256sum ./* > "manifest-$TS.sha256")'),
      'hash deve usar nomes relativos e ser gerado dentro de WORK',
    );
    assert.ok(source.includes('cp "$WORK/manifest-$TS.sha256" "$BACKUP_DIR/manifest-$TS.sha256"'));
    assert.ok(!source.includes('sha256sum "$WORK"/*'), 'nenhum hash com caminho absoluto de WORK');
    const manifestIdx = source.indexOf('sha256sum ./*');
    const tarIdx = source.indexOf('tar -czf "$BACKUP_DIR/synkroo-backup-$TS.tar.gz"');
    assert.ok(manifestIdx > 0 && tarIdx > 0 && manifestIdx < tarIdx, 'manifest nasce antes do tar');
  });

  test('rclone ausente/falho chama fail; sucesso só depois do gate', () => {
    assert.ok(source.includes('fail "rclone não configurado'));
    assert.ok(source.includes('fail "rclone não instalado'));
    assert.ok(source.includes('fail "rclone move falhou'));
    assert.ok(source.includes('command -v rclone >/dev/null 2>&1'));
    assert.ok(!source.includes('log "aviso: rclone'), 'aviso de rclone não pode degradar para sucesso');
    const gateIdx = source.indexOf('command -v rclone');
    const successPingIdx = source.indexOf('"${BACKUP_HC_PING_URL:-}" >/dev/null');
    assert.ok(gateIdx > 0 && successPingIdx > 0 && gateIdx < successPingIdx);
  });
});

// ─── Harness executando o script real ───────────────────────────────────────

runtimeDescribe('backup-synkroo.sh — manifest portátil e falha off-host (harness sintético)', () => {
  test('caminho feliz: manifest relativo dentro do tar, move off-host e ping de sucesso', () => {
    const { dir, status, output } = runScenario({});
    assert.equal(status, 0, `script deveria concluir: status=${status}\n${output}`);

    // Ping: exatamente um, de sucesso — nunca /fail.
    assert.deepEqual(pingLines(dir), [PING_URL]);

    const log = readBackupLog(dir);
    assert.match(log, /backup concluido/);

    // O move sintético levou o tar para o destino off-host.
    const dest = listDir(dir, 'rclone-dest');
    assert.equal(dest.length, 1, `destino off-host deve ter 1 arquivo: ${dest.join(',')}`);
    assert.match(dest[0], /^synkroo-backup-\d{8}-\d{6}\.tar\.gz$/);
    assert.match(readOr(dir, 'rclone.log'), /rclone move .*gdrive:synkroo-contabo-backups\//);

    // Local: tar sai (move), manifest adjacente permanece para retenção local.
    const backups = listDir(dir, 'backups');
    assert.ok(
      !backups.some((f) => /^synkroo-backup-.*\.tar\.gz$/.test(f)),
      `tar não deve permanecer local após move: ${backups.join(',')}`,
    );
    assert.ok(backups.some((f) => /^manifest-.*\.sha256$/.test(f)));

    // Dumps sintéticos entraram no archive.
    assert.match(readOr(dir, 'docker.log'), /pg_dump .*-d synkroo -Fc/);
    assert.match(readOr(dir, 'docker.log'), /pg_dump .*-d synkroo_staging -Fc/);

    assertPortableManifest(dir, join(dir, 'rclone-dest', dest[0]));
  });

  test('staging ausente: manifest cobre exatamente os membros presentes', () => {
    const { dir, status, output } = runScenario({ staging: false });
    assert.equal(status, 0, `status=${status}\n${output}`);

    const dest = listDir(dir, 'rclone-dest');
    assert.equal(dest.length, 1);
    assertPortableManifest(dir, join(dir, 'rclone-dest', dest[0]));

    const members = tarMembers(join(dir, 'rclone-dest', dest[0]));
    assert.ok(!members.some((m) => m.includes('synkroo_staging')), 'sem dump de staging no archive');
    assert.match(readBackupLog(dir), /dump de staging pulado/);
  });

  test('rclone move falhou: exit != 0, ping /fail, local preservado, sem ping de sucesso', () => {
    const { dir, status, output } = runScenario({ rcloneMode: 'fail' });
    const log = readBackupLog(dir);
    const tar = assertFailureEmittedNoSuccess(dir, log, status);
    assert.match(log, /FALHOU: rclone move falhou/);
    // A tentativa de move aconteceu (não é ausência de config).
    assert.match(readOr(dir, 'rclone.log'), /rclone move /);
    assertPortableManifest(dir, tar);
  });

  test('rclone.conf ausente: falha antes de qualquer move, sem ping de sucesso', () => {
    const { dir, status } = runScenario({ rcloneConfig: false });
    const log = readBackupLog(dir);
    const tar = assertFailureEmittedNoSuccess(dir, log, status);
    assert.match(log, /FALHOU: rclone não configurado/);
    // Nenhuma tentativa de move: o gate fecha antes.
    assert.ok(!existsSync(join(dir, 'rclone.log')), 'move não deve ser tentado sem config');
    assertPortableManifest(dir, tar);
  });

  test('binário rclone ausente: falha antes de qualquer move, sem ping de sucesso', () => {
    const { dir, status } = runScenario({ rclonePresent: false });
    const log = readBackupLog(dir);
    const tar = assertFailureEmittedNoSuccess(dir, log, status);
    assert.match(log, /FALHOU: rclone não instalado/);
    assert.ok(!existsSync(join(dir, 'rclone.log')), 'move não deve ser tentado sem binário');
    assertPortableManifest(dir, tar);
  });
});
