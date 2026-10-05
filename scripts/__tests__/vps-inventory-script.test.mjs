/**
 * scripts/__tests__/vps-inventory-script.test.mjs
 *
 * Contract tests for ops/vps/inventory/collect-inventory.sh (P2 source
 * inventory: runbook §3, "Inventário obrigatório").
 *
 * Local-only: static assertions over the script source plus, when a `bash` is
 * reachable, a syntax check and two real invocations against a temp dir. No VPS,
 * no SSH, no network, no credentials. The commands the script collects do run
 * against the *test machine* — they are read-only, and their failures are the
 * expected `[indisponivel: ...]` markers, not test failures.
 *
 * Secrets policy: every sample line below uses synthetic values, and the tests
 * assert the values are ABSENT from the redacted output.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const inventoryDir = join(root, 'ops', 'vps', 'inventory');
const SCRIPT = join(inventoryDir, 'collect-inventory.sh');
const README = join(inventoryDir, 'README.md');
const src = readFileSync(SCRIPT, 'utf8');
const readme = readFileSync(README, 'utf8');

/** Banner the operator must see before sharing the file (runbook §3). */
const REVIEW_BANNER = 'REVISAR ANTES DE COMPARTILHAR';
const REDACTION_MARKER = '<redacted>';

/**
 * The script with whole-line `#` comments removed. The header documents the
 * contract in prose (it even names `set -e` and `sudo`); structural assertions
 * must look at code only or they would match their own documentation.
 */
const code = src
  .split('\n')
  .filter((line) => !/^\s*#/.test(line))
  .join('\n');

/** Exactly the runbook §3 list — see docs/runbooks/2026-10-05-… §3. */
const SECTION_3_COMMANDS = [
  'hostname',
  'uname -a',
  'df -h',
  'free -h',
  'docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"',
  'docker compose ls',
  'docker network ls',
  'docker volume ls',
  'systemctl --failed',
  'systemctl list-timers --all',
  'crontab -l',
  'sudo -n ss -lntup',
];

/* -------------------------------------------------------------------------- *
 * bash probe (once, cached): the `bash` on PATH may be Git Bash (MSYS), the
 * WSL launcher, a real Linux shell, or missing. Skip the runtime blocks when it
 * is missing; translate paths only when the shell cannot see them as given.
 * -------------------------------------------------------------------------- */

/**
 * One-shot probe: the `bash` on PATH may be Git Bash (MSYS), the WSL launcher,
 * a real Linux shell, or missing. Returns null when the shell cannot see the
 * script, so the runtime blocks skip instead of failing on a path mismatch.
 * @returns {{sh: string, isWsl: boolean}|null}
 */
function probeBash() {
  const alive = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8', timeout: 30_000 });
  if (alive.error || alive.status !== 0 || !/ok/.test(alive.stdout ?? '')) return null;

  const isWsl = detectWsl();
  // The path is embedded in the `-c` string on purpose: the WSL launcher does
  // not forward operands after the command string, so `"$0"` would resolve to
  // the shell binary instead of the path.
  const probePath = translate(SCRIPT, isWsl);
  const visible = spawnSync('bash', ['-c', `test -f "${probePath}"`], { encoding: 'utf8', timeout: 30_000 });
  if (visible.status !== 0) return null;
  return { sh: 'bash', isWsl };
}

/** True when the probed `bash` is the WSL launcher (needs /mnt/<drive> paths). */
function detectWsl() {
  const rel = spawnSync('bash', ['-c', 'cat /proc/sys/kernel/osrelease'], { encoding: 'utf8', timeout: 30_000 });
  return /microsoft/i.test(rel.stdout ?? '');
}

/**
 * Translates an absolute path for the probed shell.
 *
 * WSL exposes Windows drives under /mnt/<drive> and, unlike a real Linux shell,
 * it does not accept `D:/...` operands — so a Windows path is rewritten per
 * drive (the temp dir is often on another drive than the repo). MSYS/Git Bash
 * and a real Linux shell take the path as-is (LF-normalized).
 */
function translate(p, isWsl) {
  const norm = String(p).replace(/\\/g, '/');
  const m = /^([A-Za-z]):\/(.*)$/.exec(norm);
  if (!m || !isWsl) return norm;
  return `/mnt/${m[1].toLowerCase()}/${m[2]}`;
}

const bash = probeBash();
const isWsl = bash !== null && bash.isWsl;
const shellPath = (p) => translate(p, isWsl);
const scriptArg = bash === null ? SCRIPT : shellPath(SCRIPT);
const SKIP = bash === null ? 'bash indisponivel neste ambiente' : false;

/** The bash-available syntax check, probed exactly once at module load. */
const syntaxCheck = bash === null
  ? null
  : spawnSync(bash.sh, ['-n', scriptArg], { encoding: 'utf8', timeout: 30_000 });

/** Every invocation of the real script gets an explicit timeout. */
const runInventory = (args, options = {}) =>
  spawnSync(bash.sh, [scriptArg, ...args], { encoding: 'utf8', timeout: 30_000, ...options });

// ─── §3: a lista de comandos é o contrato do inventário ──────────────────────

for (const cmd of SECTION_3_COMMANDS) {
  test(`§3: o inventário coleta "${cmd}"`, () => {
    assert.ok(src.includes(cmd), `comando ausente no script: ${cmd}`);
  });
}

test('§3: cada comando é exibido no relatório (seção + linha "$ <cmd>")', () => {
  assert.ok(src.includes('section "docker ps"'), 'seção docker ps ausente');
  assert.ok(src.includes("printf '$ %s\\n'"), 'cabeçalho "$ <comando>" ausente');
});

test('§3: sudo é não interativo (sudo -n) com fallback sem privilégio', () => {
  assert.ok(src.includes('run_privileged "sudo -n ss -lntup || ss -lntup" ss -lntup'), 'fallback de ss ausente');
  assert.ok(src.includes('sudo -n "$@"'), 'sudo deve ser invocado com -n (nunca pedir senha)');
  // Toda menção a `sudo` no código tem de ser `command -v sudo` ou `sudo -n`.
  const sudoLines = code.split('\n').filter((line) => /\bsudo\b/.test(line));
  assert.ok(sudoLines.length > 0, 'nenhuma chamada a sudo encontrada');
  for (const line of sudoLines) {
    assert.match(line, /command -v sudo|sudo -n/, `uso interativo de sudo: ${line.trim()}`);
  }
});

// ─── best-effort: falha de um comando não aborta o inventário ────────────────

test('best-effort: sem set -e, e binário ausente vira marcador', () => {
  assert.ok(src.includes('set -u'), 'set -u ausente');
  assert.ok(!/\bset\s+-e\b/.test(code), 'set -e proibido: a coleta é best-effort');
  assert.ok(src.includes('[indisponível: %s]'), 'marcador [indisponível: ...] ausente');
  assert.ok(src.includes('command -v "$1" >/dev/null 2>&1'), 'guarda de binário ausente ausente');
});

test('best-effort: fail-closed quando a redação não pode rodar', () => {
  assert.ok(src.includes('command -v awk'), 'precondição de awk ausente');
  assert.ok(src.includes('a redação falhou; nenhum relatório foi gravado (fail-closed)'), 'fail-closed da redação ausente');
});

// ─── redação: patterns exigidos, sem rede e sem eco de env ──────────────────

test('redação: marcador de valor redigido presente no script', () => {
  assert.ok(src.includes(REDACTION_MARKER), `marcador ${REDACTION_MARKER} ausente`);
  assert.ok(src.includes('awk "$AWK_PROGRAM"'), 'a passagem de redação não é executada antes de gravar');
  // redação antes da escrita final, não depois
  assert.ok(src.indexOf('awk "$AWK_PROGRAM"') < src.indexOf('cat "$REDACTED_FILE" >>"$OUT_FILE"'), 'redação deve ocorrer antes de montar o arquivo final');
});

test('redação: lista de chaves sensíveis completa e case-insensitive', () => {
  const keys = ['authorization', 'apikey', 'api_key', 'api-key', 'password', 'passwd', 'secret', 'token', 'pwd'];
  const program = extractAwkProgram();
  for (const key of keys) {
    assert.ok(program.includes(key), `chave sensível ausente do programa de redação: ${key}`);
  }
  assert.ok(program.includes('tolower('), 'a comparação das chaves precisa ser case-insensitive');
});

test('redação: userinfo de URL vira protocolo://usuario:<redacted>@host', () => {
  const program = extractAwkProgram();
  assert.ok(program.includes('"://"'), 'marcador de esquema de URL ausente');
  assert.ok(program.includes(':<redacted>@'), 'substituição do userinfo de URL ausente');
});

test('redação: nunca grava o bruto (temporário é removido no exit)', () => {
  assert.ok(src.includes('trap cleanup EXIT INT TERM'), 'trap de limpeza ausente');
  assert.ok(src.includes('rm -f "$RAW_FILE"'), 'remoção do bruto ausente');
  assert.ok(src.includes('umask 077'), 'umask 077 ausente (bruto e relatório saem 0600)');
});

test('sem rede e sem eco de valor de variável de ambiente', () => {
  assert.ok(!/\bcurl\b/.test(src), 'o inventário não pode fazer curl');
  assert.ok(!/\bwget\b/.test(src), 'o inventário não pode fazer wget');
  assert.ok(!/\bnc\b/.test(src), 'o inventário não pode abrir socket com nc');
  assert.ok(!/\bprintenv\b/.test(src), 'printenv despejaria o ambiente no relatório');
  assert.ok(!/\becho\s+\$/.test(src), 'echo $VAR pode vazar valor de env; use printf com aspas');
  assert.ok(!/\$\{?[A-Z_]*(?:PASSWORD|SECRET|TOKEN|KEY)[A-Z_]*\}?/.test(code), 'nenhuma variável de ambiente sensível deve ser lida');
});

test('escrita confinada ao --out (nenhum path absoluto de escrita)', () => {
  assert.ok(src.includes('OUT_DIR="."'), 'default do --out ausente');
  assert.ok(src.includes('OUT_FILE="$OUT_DIR/inventory-$SIDE-$UTC_STAMP.txt"'), 'nome do arquivo fora do padrão inventory-<side>-<ts>.txt');
  assert.ok(!/\b(?:cp|mv|tee|dd)\b/.test(code), 'nenhuma cópia de arquivo pode existir no inventário');
  assert.ok(!/\/(?:etc|var|opt|home|root)\//.test(code), 'nenhuma escrita em path absoluto fora do --out');
});

// ─── contrato --side fail-closed ─────────────────────────────────────────────

test('--side: obrigatório, validado e com saída 1 no caminho de erro', () => {
  assert.ok(src.includes('case "$1" in'), 'parsing de argumentos ausente');
  assert.ok(src.includes('--side=*)'), 'forma --side=valor ausente');
  assert.ok(src.includes('SIDE="$2"'), 'forma --side valor ausente');
  assert.ok(src.includes('[ -n "$SIDE" ] || die_usage'), '--side ausente não pode ser fail-closed');
  assert.ok(src.includes('source|target)'), 'aceita apenas source|target');
  assert.ok(src.includes('--side inválido'), 'mensagem de --side inválido ausente');
});

test('--side: uso vai para stderr e termina com exit 1', () => {
  const usage = src.slice(src.indexOf('usage()'), src.indexOf('die_usage()'));
  assert.ok(usage.includes('USAGE'), 'bloco de uso ausente');
  assert.ok(src.includes('usage >&2'), 'o erro de uso precisa ir para stderr');
  assert.ok(src.includes('exit 1'), 'caminho de erro precisa sair com 1');
  assert.ok(usage.includes('--side=source|target'), 'o uso precisa documentar --side');
  assert.ok(usage.includes('--out'), 'o uso precisa documentar --out');
});

// ─── cabeçalho e rodapé do relatório ────────────────────────────────────────

test('relatório: cabeçalho com side, timestamp UTC, hostname e aviso de revisão', () => {
  assert.ok(src.includes("printf 'side: %s\\n'"), 'side ausente do cabeçalho');
  assert.ok(src.includes("printf 'timestamp-utc: %s\\n'"), 'timestamp UTC ausente do cabeçalho');
  assert.ok(src.includes("printf 'hostname: %s\\n'"), 'hostname ausente do cabeçalho');
  assert.ok(src.includes('date -u +%Y%m%dT%H%M%SZ'), 'timestamp deve ser UTC (date -u)');
  assert.ok(src.includes(REVIEW_BANNER), 'aviso de revisão antes de compartilhar ausente');
});

test('relatório: rodapé lembra a revisão manual do crontab', () => {
  const footer = src.slice(src.indexOf('Lembrete final'));
  assert.ok(footer.includes('crontab -l'), 'rodapé deve citar a seção crontab -l');
  assert.ok(footer.includes('antes de compartilhar'), 'rodapé deve exigir revisão antes de compartilhar');
  assert.ok(src.trimEnd().endsWith('exit 0'), 'o script deve terminar com exit 0 após gravar');
});

test('runbook: §3 referenciado no script e no README', () => {
  assert.ok(src.includes('2026-10-05-hostinger-to-contabo-and-waha-migration.md'), 'referência ao runbook ausente');
  assert.ok(readme.includes('2026-10-05-hostinger-to-contabo-and-waha-migration.md'), 'README deve citar o runbook');
  assert.ok(readme.includes('docs/inventory/'), 'README deve dizer onde o resultado pode ser commitado');
});

// ─── README: como rodar sem copiar o script antes ────────────────────────────

test('README: pipe por ssh e variante scp documentados', () => {
  assert.ok(readme.includes("bash -s -- --side=source"), 'pipe por ssh ausente');
  assert.ok(readme.includes("bash -s -- --side=target"), 'pipe por ssh do target ausente');
  assert.ok(readme.includes('< ops/vps/inventory/collect-inventory.sh'), ' redirecionamento do script ausente');
  assert.ok(readme.includes('scp ops/vps/inventory/collect-inventory.sh'), 'variante scp ausente');
});

test('README: destino do arquivo, regra de revisão e checklist P2', () => {
  assert.ok(readme.includes('inventory-<side>-<timestamp UTC>.txt'), 'nome do arquivo no README ausente');
  assert.ok(REVIEW_BANNER.length > 0 && readme.includes(REVIEW_BANNER), 'regra de revisão antes de compartilhar ausente');
  for (const item of ['Evolution', 'Traefik', 'rede Docker', 'cron/systemd/PM2', 'certificados', 'firewall', 'volumes', 'observabilidade', 'backups']) {
    assert.ok(readme.includes(item), `item do checklist "Descobrir" ausente no README: ${item}`);
  }
});

// ─── awk: extração do programa e comportamento real da redação ───────────────

/** The redaction awk program, extracted from the single-quoted heredoc. */
function extractAwkProgram() {
  const match = /<<'SYNKROO_INVENTORY_AWK_PROG'\n([\s\S]*?)\nSYNKROO_INVENTORY_AWK_PROG\n/.exec(src);
  assert.ok(match, 'programa awk de redação não encontrado no script');
  return match[1];
}

const SYNTHETIC_SAMPLE = [
  'DATABASE_URL=postgres://synkroo:S3cr3tUrl@db.internal:5432/synkroo?sslmode=require',
  'PASSWORD: S3cr3tColon',
  'api_key=S3cr3tApiKey',
  'Authorization: Bearer S3cr3tBearer',
  'POSTGRES_PASSWORD=postgres://u:S3cr3tInner@h/db',
  // Nota: o canário é uma linha config/env (`X-Api-Key: <valor>`), NÃO uma
  // invocação `curl -H …`. A regra `curl-auth-header` do gitleaks (8.24) casa
  // com `curl` ou com `-H` + header de auth, e o pre-commit escaneia uma cópia
  // em mktemp — fingerprints relativos do .gitleaksignore nunca casam lá.
  // O que o canário exercita é a redação de `api-key: valor`, idêntica ao
  // canário `PASSWORD:` acima e agnóstica ao arquivo que a contém.
  'X-Api-Key: S3cr3tHeader',
  '*/5 * * * * /usr/local/bin/backup.sh --token S3cr3tFlag --quiet',
  'postgres://user@host/db',
  'linha sem segredo nenhum',
  '-----BEGIN RSA PRIVATE KEY-----',
  'MIIEowS3cr3tPEM',
  '-----END RSA PRIVATE KEY-----',
  'token=S3cr3tDepois',
].join('\n');

function runRedaction(input) {
  const dir = mkdtempSync(join(tmpdir(), 'synkroo-inv-awk-'));
  try {
    const programFile = join(dir, 'redact.awk');
    writeFileSync(programFile, extractAwkProgram());
    // awk vive no mesmo userland do bash: executa através dele. O path vai
    // embutido no `-c` porque o launcher do WSL não repassa operandos.
    const r = spawnSync(bash.sh, ['-c', `awk -f "${shellPath(programFile)}"`], {
      encoding: 'utf8',
      input,
      timeout: 30_000,
    });
    assert.equal(r.status, 0, `awk falhou: ${r.stderr ?? ''}`);
    return r.stdout ?? '';
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('redação: nenhum valor sintético sobrevive (chave=valor, header e flag)', { skip: SKIP }, () => {
  const out = runRedaction(SYNTHETIC_SAMPLE);
  for (const secret of [
    'S3cr3tUrl',
    'S3cr3tColon',
    'S3cr3tApiKey',
    'S3cr3tBearer',
    'S3cr3tInner',
    'S3cr3tHeader',
    'S3cr3tFlag',
    'S3cr3tPEM',
    'S3cr3tDepois',
  ]) {
    assert.ok(!out.includes(secret), `segredo sobreviveu à redação: ${secret}`);
  }
});

test('redação: URL com senha vira protocolo://usuario:<redacted>@host', { skip: SKIP }, () => {
  const out = runRedaction(SYNTHETIC_SAMPLE);
  assert.ok(
    out.includes('postgres://synkroo:<redacted>@db.internal:5432/synkroo?sslmode=require'),
    `userinfo de URL não redigido: ${out}`,
  );
});

test('redação: linhas sem segredo seguem intactas', { skip: SKIP }, () => {
  const out = runRedaction(SYNTHETIC_SAMPLE);
  assert.ok(out.includes('linha sem segredo nenhum'), 'linha neutra foi alterada');
  assert.ok(out.includes('postgres://user@host/db'), 'URL sem senha deve seguir legível');
});

test('redação: corpo de chave privada é descartado', { skip: SKIP }, () => {
  const out = runRedaction(SYNTHETIC_SAMPLE);
  assert.ok(!out.includes('MIIEow'), 'corpo de chave privada sobreviveu');
  assert.ok(/chave privada/.test(out), 'o bloco de chave privada deveria estar sinalizado no relatório');
});

// ─── execução real do script (somente com bash disponível) ───────────────────

const scriptOut = mkdtempSync(join(tmpdir(), 'synkroo-inv-out-'));
after(() => rmSync(scriptOut, { recursive: true, force: true }));

test('bash -n: o script é sintaticamente válido', { skip: SKIP }, () => {
  assert.equal(syntaxCheck.error, undefined, `bash -n não executou: ${syntaxCheck.error?.message}`);
  assert.equal(syntaxCheck.status, 0, `bash -n reprovou: ${syntaxCheck.stderr ?? ''}`);
});

test('sem --side: imprime o uso em stderr e sai com código != 0', { skip: SKIP }, () => {
  const r = runInventory(['--out', shellPath(scriptOut)]);
  assert.notEqual(r.status, 0, 'sem --side o script deveria falhar fechado');
  const err = r.stderr ?? '';
  assert.ok(err.includes('--side'), `uso deveria citar --side em stderr: ${err}`);
  assert.ok(!/invent.rio gravado/i.test(r.stdout ?? ''), 'nada deveria ter sido coletado');
  assert.deepEqual(
    readdirSync(scriptOut),
    [],
    'nenhum arquivo de inventário pode ser criado quando --side falta',
  );
});

test('--side inválido: falha fechada e não grava nada', { skip: SKIP }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'synkroo-inv-bad-'));
  try {
    const r = runInventory(['--side=teste', '--out', shellPath(dir)]);
    assert.notEqual(r.status, 0, '--side inválido deveria falhar fechado');
    assert.ok((r.stderr ?? '').includes('--side'), 'mensagem de erro deveria citar --side');
    assert.deepEqual(readdirSync(dir), [], 'nenhum arquivo pode ser criado com --side inválido');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

for (const side of ['source', 'target']) {
  test(`--side=${side}: exit 0, arquivo inventory-${side}-<ts>.txt com aviso de revisão`, { skip: SKIP }, () => {
    const dir = mkdtempSync(join(tmpdir(), `synkroo-inv-${side}-`));
    try {
      const r = runInventory([`--side=${side}`, '--out', shellPath(dir)]);
      assert.equal(r.status, 0, `coleta falhou: ${r.stderr ?? ''}`);

      const files = readdirSync(dir).filter((f) => f.startsWith(`inventory-${side}-`) && f.endsWith('.txt'));
      assert.equal(files.length, 1, `esperado 1 inventário de --side=${side}, veio: ${readdirSync(dir).join(', ')}`);
      assert.match(files[0], /^inventory-source-\d{8}T\d{6}Z\.txt$|^inventory-target-\d{8}T\d{6}Z\.txt$/, `nome fora do padrão: ${files[0]}`);

      const content = readFileSync(join(dir, files[0]), 'utf8');
      assert.ok(content.includes(REVIEW_BANNER), 'aviso de revisão antes de compartilhar ausente');
      assert.ok(content.includes(`side: ${side}`), `lado não registrado no cabeçalho: ${side}`);
      assert.ok(content.includes('timestamp-utc:'), 'timestamp UTC ausente');
      assert.ok(content.includes('$ uname -a'), 'seção uname -a ausente (comandos que falham viram marcador)');
      assert.ok(content.includes('$ crontab -l'), 'seção crontab -l ausente');
      assert.ok(content.includes('$ docker volume ls'), 'seção docker volume ls ausente');

      // Nada de temporário sobreviveu (bruto não redigido é removido no exit).
      const leftovers = readdirSync(dir).filter((f) => f.startsWith('.inventory-'));
      assert.deepEqual(leftovers, [], `temporário do bruto sobreviveu ao exit: ${leftovers.join(', ')}`);

      // O rodapé é a última linha do arquivo.
      const lines = content.trimEnd().split('\n');
      const last = lines[lines.length - 1];
      assert.ok(last.includes('crontab -l'), `última linha deveria ser o lembrete do crontab: ${last}`);
      assert.ok(last.includes('compartilhar'), `última linha deveria exigir revisão antes de compartilhar: ${last}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('o relatório redigido não carrega segredo de env do processo de teste', { skip: SKIP }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'synkroo-inv-env-'));
  const canary = 'S3cr3tEnvCanary';
  try {
    const r = runInventory(['--side=source', '--out', shellPath(dir)], {
      env: { ...process.env, SYN_TEST_SECRET: canary, POSTGRES_PASSWORD: canary, VPS_SOURCE_POSTGRES_PASSWORD: canary },
    });
    assert.equal(r.status, 0, `coleta falhou: ${r.stderr ?? ''}`);
    const file = readdirSync(dir).find((f) => f.endsWith('.txt'));
    assert.ok(file, 'arquivo de inventário não criado');
    const content = readFileSync(join(dir, file), 'utf8');
    assert.ok(!content.includes(canary), 'valor de env do processo vazou para o inventário');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
