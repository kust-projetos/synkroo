import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import {
  describeOrigin,
  getVpsValue,
  isDryRun,
  loadVpsEnv,
  parseVpsEnvContent,
  redactSecrets,
  requireVpsValue,
  resolveVpsEnvPath,
  writeVpsEnvKey,
} from '../lib/load-vps-env.ts';

// Valores ficticios de baixa entropia (nunca segredos reais; vide gitleaks).
const FAKE_ENV_LF = [
  '# comentario de cabecalho',
  '',
  'VPS_IP=10.0.0.1',
  'VPS_PG_PORT=5432',
  'VPS_POSTGRES_PASSWORD="senha-producao-ficticia"',
  "VPS_STAGING_PASSWORD='senha-staging-ficticia'",
  'CONN_STRING=postgres://u:p@h:5432/db?sslmode=require',
  '  SPACED_KEY  =  com espacos  ',
  'MALFORMED-WITHOUT-EQUALS',
  '',
].join('\n');

function makeProject() {
  const root = mkdtempSync(join(tmpdir(), 'vps env space '));
  const proj = join(root, 'proj');
  mkdirSync(proj, { recursive: true });
  return { root, proj };
}

test('(1) env explicito valido via SYNKROO_VPS_ENV', () => {
  const { proj } = makeProject();
  const file = join(proj, 'vps.env');
  writeFileSync(file, FAKE_ENV_LF, 'utf8');
  const loaded = loadVpsEnv({
    cwd: proj,
    env: { SYNKROO_VPS_ENV: file },
    requiredKeys: ['VPS_IP', 'VPS_PG_PORT'],
  });
  assert.equal(loaded.origin, 'explicit');
  assert.equal(loaded.configPath, resolve(file));
  assert.equal(loaded.values.VPS_IP, '10.0.0.1');
  assert.equal(loaded.values.VPS_POSTGRES_PASSWORD, 'senha-producao-ficticia');
  assert.equal(loaded.values.VPS_STAGING_PASSWORD, 'senha-staging-ficticia');
  // '=' preservado no valor; espacos aparados; linha malformada ignorada.
  assert.equal(loaded.values.CONN_STRING, 'postgres://u:p@h:5432/db?sslmode=require');
  assert.equal(loaded.values.SPACED_KEY, 'com espacos');
  assert.ok(!('MALFORMED-WITHOUT-EQUALS' in loaded.values));
});

test('(2) fallback legado com aviso de deprecacao (sem valores)', () => {
  const { root, proj } = makeProject();
  const legacyDir = join(root, 'vps-hostinger');
  mkdirSync(legacyDir, { recursive: true });
  writeFileSync(join(legacyDir, '.env'), 'VPS_IP=10.0.0.2\n', 'utf8');
  const warnings = [];
  const loaded = loadVpsEnv({ cwd: proj, env: {}, warn: (m) => warnings.push(m) });
  assert.equal(loaded.origin, 'legacy');
  assert.equal(loaded.configPath, resolve(legacyDir, '.env'));
  assert.equal(loaded.values.VPS_IP, '10.0.0.2');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /deprecat/i);
  assert.ok(!warnings[0].includes('10.0.0.2'), 'aviso nao pode vazar valores');
});

test('(3a) SYNKROO_VPS_ENV explicito inexistente falha com path + instrucao', () => {
  const { proj } = makeProject();
  const missing = join(proj, 'nao-existe.env');
  assert.throws(
    () => loadVpsEnv({ cwd: proj, env: { SYNKROO_VPS_ENV: missing } }),
    (err) => {
      assert.match(err.message, /not found/);
      assert.ok(err.message.includes(missing), 'erro deve conter o path resolvido');
      assert.match(err.message, /SYNKROO_VPS_ENV/);
      return true;
    },
  );
});

test('(3b) modo escrita sem arquivo falha; modo leitura permite env-only', () => {
  const { proj } = makeProject();
  assert.throws(
    () => loadVpsEnv({ cwd: proj, env: {}, requireFile: true }),
    /SYNKROO_VPS_ENV/,
  );
  const loaded = loadVpsEnv({ cwd: proj, env: { VPS_IP: '10.9.9.9' } });
  assert.equal(loaded.origin, 'env-only');
  assert.equal(loaded.configPath, null);
  assert.deepEqual(loaded.values, {});
  assert.equal(getVpsValue(loaded, 'VPS_IP', { VPS_IP: '10.9.9.9' }), '10.9.9.9');
});

test('(4) arquivo invalido: linhas ruins ignoradas, requiredKeys falham claro', () => {
  const { proj } = makeProject();
  const file = join(proj, 'vps.env');
  writeFileSync(file, '### so comentarios\n\n   \nSEM-IGUAL\n# fim\n', 'utf8');
  assert.deepEqual(parseVpsEnvContent('### so comentarios\n\nSEM-IGUAL\n'), {});
  assert.throws(
    () =>
      loadVpsEnv({
        cwd: proj,
        env: { SYNKROO_VPS_ENV: file },
        requiredKeys: ['VPS_IP'],
      }),
    (err) => {
      assert.match(err.message, /VPS_IP is missing/);
      assert.match(err.message, /SYNKROO_VPS_ENV/);
      return true;
    },
  );
});

test('(5) segredos nao vazam nos logs', () => {
  const secret = 'senha-producao-ficticia';
  // redactSecrets cobre argv --password=... e valores exatos.
  const scrubbed = redactSecrets(
    `cmd --password=${secret} falhou; stdout menciona ${secret}`,
    [secret],
  );
  assert.ok(!scrubbed.includes(secret));
  assert.match(scrubbed, /--password=\[REDACTED\]/);
  // Origem e erros citam paths/chaves, nunca valores.
  const origin = describeOrigin({ configPath: '/tmp/x/vps.env', origin: 'explicit' });
  assert.ok(!origin.includes(secret));
  const loaded = { values: { VPS_IP: '10.0.0.1' }, configPath: null, origin: 'env-only' };
  assert.throws(() => requireVpsValue(loaded, 'VPS_POSTGRES_PASSWORD', {}), (err) => {
    assert.ok(!err.message.includes(secret));
    assert.match(err.message, /SYNKROO_VPS_ENV/);
    return true;
  });
});

test('(6) path Windows absoluto com espacos', () => {
  const { proj } = makeProject();
  const spaced = join(proj, 'dir com espacos', 'vps.env');
  mkdirSync(join(proj, 'dir com espacos'), { recursive: true });
  writeFileSync(spaced, 'VPS_IP=10.0.0.6\n', 'utf8');
  // No Windows o path absoluto inclui drive (C:\...); em qualquer OS o
  // resolvido deve ser absoluto e conter os espacos.
  const { configPath, origin } = resolveVpsEnvPath({
    cwd: proj,
    env: { SYNKROO_VPS_ENV: spaced },
  });
  assert.equal(origin, 'explicit');
  assert.equal(configPath, resolve(spaced));
  assert.ok(configPath.includes(' '), 'espacos no path devem sobreviver');
  assert.ok(resolve(configPath) === configPath, 'path resolvido deve ser absoluto');
  if (sep === '\\') {
    assert.match(configPath, /^[A-Za-z]:\\/);
  }
  const loaded = loadVpsEnv({ cwd: proj, env: { SYNKROO_VPS_ENV: spaced } });
  assert.equal(loaded.values.VPS_IP, '10.0.0.6');
});

test('(7) path estilo Linux (barras) relativo resolve a partir do cwd', () => {
  const { proj } = makeProject();
  writeFileSync(join(proj, 'vps.env'), 'VPS_IP=10.0.0.7\n', 'utf8');
  const { configPath, origin } = resolveVpsEnvPath({
    cwd: proj,
    env: { SYNKROO_VPS_ENV: './vps.env' },
  });
  assert.equal(origin, 'explicit');
  assert.equal(configPath, resolve(proj, 'vps.env'));
});

test('(8) escrita atomica: inalterado nao reescreve; alteracao gera .bak', () => {
  const { proj } = makeProject();
  const file = join(proj, 'dir com espacos.env');
  writeFileSync(file, 'VPS_IP=10.0.0.8\n', 'utf8');
  assert.equal(writeVpsEnvKey(file, 'VPS_IP', '10.0.0.8'), 'unchanged');
  assert.ok(!existsSync(`${file}.bak`), 'sem mudanca nao deve gerar backup');
  assert.equal(writeVpsEnvKey(file, 'VPS_STAGING_PASSWORD', 'senha-staging-ficticia'), 'updated');
  assert.ok(existsSync(`${file}.bak`), 'mudanca deve gerar .bak');
  assert.ok(!existsSync(`${file}.tmp.${process.pid}`), 'tmp deve ser renomeado');
  const parsed = parseVpsEnvContent(readFileSync(file, 'utf8'));
  assert.equal(parsed.VPS_STAGING_PASSWORD, 'senha-staging-ficticia');
  assert.equal(parsed.VPS_IP, '10.0.0.8');
  // Recusa escrever sem arquivo resolvido e com chave invalida.
  assert.throws(() => writeVpsEnvKey(null, 'VPS_IP', 'x'), /SYNKROO_VPS_ENV/);
  assert.throws(() => writeVpsEnvKey(file, 'KEY INVALID', 'x'), /invalid key/);
});

test('(10) escrita preserva 0600 no destino e no .bak (CWE-732)', () => {
  if (process.platform === 'win32') {
    console.log('skip: chmod 0600 nao se aplica no Windows (ACL apenas; chmod e no-op)');
    return;
  }
  const { proj } = makeProject();
  const file = join(proj, 'vps.env');
  writeFileSync(file, 'VPS_IP=10.0.0.10\n', { encoding: 'utf8', mode: 0o600 });
  chmodSync(file, 0o600);
  assert.equal(writeVpsEnvKey(file, 'VPS_PG_PORT', '5432'), 'updated');
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.ok(existsSync(`${file}.bak`), 'mudanca deve gerar .bak');
  assert.equal(statSync(`${file}.bak`).mode & 0o777, 0o600);
});

test('(9) CRLF parseia identico ao LF', () => {  const lf = parseVpsEnvContent(FAKE_ENV_LF);
  const crlf = parseVpsEnvContent(FAKE_ENV_LF.replaceAll('\n', '\r\n'));
  assert.deepEqual(crlf, lf);
  for (const [k, v] of Object.entries(crlf)) {
    assert.ok(!k.includes('\r'), `chave com \\r: ${k}`);
    assert.ok(!v.includes('\r'), `valor com \\r em ${k}`);
  }
});

test('extras: precedencia process.env > arquivo; isDryRun', () => {
  const { proj } = makeProject();
  const file = join(proj, 'vps.env');
  writeFileSync(file, 'VPS_IP=10.0.0.1\nVPS_PG_PORT=5432\n', 'utf8');
  const loaded = loadVpsEnv({ cwd: proj, env: { SYNKROO_VPS_ENV: file } });
  assert.equal(getVpsValue(loaded, 'VPS_IP', { VPS_IP: '10.9.9.9' }), '10.9.9.9');
  assert.equal(getVpsValue(loaded, 'VPS_IP', {}), '10.0.0.1');
  assert.equal(isDryRun(['node', 'x.ts', '--dry-run']), true);
  assert.equal(isDryRun(['node', 'x.ts']), false);
});
