/**
 * Contract tests for the provider-neutral VPS env-file resolution used by
 * scripts/migrate-vps.ts, scripts/update-hyperdrive.ts and
 * scripts/setup-staging-db.ts (shared implementation in scripts/lib/vps-env.mjs).
 *
 * Local-only: every case runs against temporary directories under os.tmpdir
 * and synthetic credentials. No VPS, SSH, wrangler or database is touched.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, describe, test } from 'node:test';

import {
  applyEnvFileWrites,
  assertEnvFileWritable,
  CREDENTIAL_FILE_MODE,
  encodeEnvValue,
  ENV_SOURCE_EXPLICIT,
  ENV_SOURCE_LEGACY,
  ENV_SOURCE_NONE,
  ENV_VALUE_UNREPRESENTABLE_CODE,
  SETTING_ORIGIN_FILE,
  SETTING_ORIGIN_PROCESS,
  VPS_ENV_PATH_VAR,
  VPS_PORT_INVALID_CODE,
  VPS_SIDE_FIELDS,
  VPS_SIDE_INVALID_CODE,
  VPS_SIDES,
  VPS_SETTING_MISSING_CODE,
  loadVpsEnv,
  parseVpsEnvContent,
  parseVpsPort,
  planEnvFileWrites,
  readCliFlag,
  readVpsSetting,
  readVpsSettingWithOrigin,
  requireVpsSideSetting,
  resolveVpsEnvPath,
  resolveVpsSideSettings,
  upsertEnvValue,
} from '../lib/vps-env.mjs';

/** Built at runtime so no raw NUL byte ends up in this source file. */
const NUL = String.fromCharCode(0);

const root = resolve(import.meta.dirname, '..', '..');

















const libSrc = readFileSync(resolve(root, 'scripts', 'lib', 'vps-env.mjs'), 'utf8');

const sandbox = mkdtempSync(join(tmpdir(), 'synkroo-vps-env-'));
const repoDir = join(sandbox, 'repo');
const scriptsDir = join(repoDir, 'scripts', 'lib');
const legacyDir = join(sandbox, 'vps-hostinger');
const legacyEnvPath = join(legacyDir, '.env');
// Repo root with NO legacy sibling, for the "nothing resolved" cases.
const isolatedRoot = join(sandbox, 'isolated', 'repo');

before(() => {
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(legacyDir, { recursive: true });
  mkdirSync(join(isolatedRoot, 'scripts', 'lib'), { recursive: true });
  writeFileSync(
    legacyEnvPath,
    ['VPS_IP=10.9.9.9', 'VPS_PG_PORT=15432', 'VPS_STAGING_PASSWORD=segredo-staging-legado', ''].join('\n'),
    'utf8',
  );
});

after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** Repo-root resolution is derived from the module URL, not from process.cwd(). */
function moduleUrlInRepo() {
  return pathToFileURL(join(scriptsDir, 'vps-env.mjs')).href;
}

function writeEnvFile(name, content) {
  const target = join(sandbox, name);
  writeFileSync(target, content, 'utf8');
  return target;
}

describe('parseVpsEnvContent', () => {
  const LF_LINES = [
    '# comentario de cabecalho',
    '',
    'VPS_IP=10.0.0.1',
    'VPS_PG_PORT=5432',
    'VPS_POSTGRES_PASSWORD="segredo-producao"',
    "VPS_STAGING_PASSWORD='segredo-staging'",
    '  SPACED_KEY  =  com espacos  ',
    '',
  ];
  const EXPECTED = {
    VPS_IP: '10.0.0.1',
    VPS_PG_PORT: '5432',
    VPS_POSTGRES_PASSWORD: 'segredo-producao',
    VPS_STAGING_PASSWORD: 'segredo-staging',
    SPACED_KEY: 'com espacos',
  };

  test('parseia conteudo LF (baseline)', () => {
    assert.deepEqual(parseVpsEnvContent(LF_LINES.join('\n')), EXPECTED);
  });

  test('parseia conteudo CRLF identico ao LF (regressao: VPS_IP is missing)', () => {
    const crlf = LF_LINES.join('\r\n');
    assert.deepEqual(parseVpsEnvContent(crlf), EXPECTED);
    assert.deepEqual(parseVpsEnvContent(crlf), parseVpsEnvContent(LF_LINES.join('\n')));
  });

  test('nenhuma chave/valor carrega \\r', () => {
    for (const content of [LF_LINES.join('\n'), LF_LINES.join('\r\n')]) {
      for (const [k, v] of Object.entries(parseVpsEnvContent(content))) {
        assert.ok(!k.includes('\r'), `chave com \\r: ${JSON.stringify(k)}`);
        assert.ok(!v.includes('\r'), `valor com \\r em ${k}: ${JSON.stringify(v)}`);
      }
    }
  });

  test('fonte tolera CRLF no split (sem depender de trim incidental)', () => {
    assert.ok(
      libSrc.includes('split(/\\r?\\n/)'),
      'vps-env.mjs deve dividir as linhas com split(/\\r?\\n/)',
    );
  });
});

describe('resolveVpsEnvPath — precedência explícita', () => {
  test('SYNKROO_VPS_ENV tem precedência sobre o fallback legado', () => {
    const explicitPath = writeEnvFile('explicit.env', 'VPS_IP=10.1.1.1\n');
    const resolved = resolveVpsEnvPath({
      env: { [VPS_ENV_PATH_VAR]: explicitPath },
      cwd: sandbox,
      moduleUrl: moduleUrlInRepo(),
    });
    assert.equal(resolved.source, ENV_SOURCE_EXPLICIT);
    assert.equal(resolved.path, explicitPath);
    // The legacy file exists in this sandbox and must NOT be chosen.
    assert.notEqual(resolved.path, legacyEnvPath);
  });

  test('caminho relativo explícito é resolvido a partir do cwd informado', () => {
    const explicitPath = writeEnvFile('relative.env', 'VPS_IP=10.1.1.2\n');
    const resolved = resolveVpsEnvPath({
      env: { [VPS_ENV_PATH_VAR]: 'relative.env' },
      cwd: sandbox,
      moduleUrl: moduleUrlInRepo(),
    });
    assert.equal(resolved.source, ENV_SOURCE_EXPLICIT);
    assert.equal(resolved.path, explicitPath);
  });

  test('fallback legado é resolvido pelo repo root do módulo, não pelo cwd', () => {
    const resolved = resolveVpsEnvPath({
      env: {},
      cwd: tmpdir(),
      moduleUrl: moduleUrlInRepo(),
    });
    assert.equal(resolved.source, ENV_SOURCE_LEGACY);
    assert.equal(resolved.path, legacyEnvPath);
  });

  test('sem variável e sem arquivo legado: source=none e path=null (sem exceção)', () => {
    const resolved = resolveVpsEnvPath({
      env: {},
      cwd: sandbox,
      moduleUrl: pathToFileURL(join(isolatedRoot, 'scripts', 'lib', 'vps-env.mjs')).href,
    });
    assert.deepEqual(resolved, { path: null, source: ENV_SOURCE_NONE });
  });
});

describe('resolveVpsEnvPath — fail closed', () => {
  test('SYNKROO_VPS_ENV apontando para arquivo inexistente aborta sem fallback', () => {
    assert.throws(
      () =>
        resolveVpsEnvPath({
          env: { [VPS_ENV_PATH_VAR]: join(sandbox, 'inexistente.env') },
          cwd: sandbox,
          moduleUrl: moduleUrlInRepo(),
        }),
      (err) => {
        assert.match(err.message, new RegExp(VPS_ENV_PATH_VAR));
        assert.match(err.message, /no file exists there/);
        return true;
      },
    );
  });

  test('SYNKROO_VPS_ENV apontando para diretório aborta', () => {
    assert.throws(
      () =>
        resolveVpsEnvPath({
          env: { [VPS_ENV_PATH_VAR]: sandbox },
          cwd: sandbox,
          moduleUrl: moduleUrlInRepo(),
        }),
      /is not a regular file/,
    );
  });

  test('arquivo legível explicitado resolve sem erro', () => {
    const explicitPath = writeEnvFile('readable.env', 'VPS_IP=10.7.7.7\n');
    const resolved = resolveVpsEnvPath({
      env: { [VPS_ENV_PATH_VAR]: explicitPath },
      cwd: sandbox,
      moduleUrl: moduleUrlInRepo(),
    });
    assert.equal(resolved.source, ENV_SOURCE_EXPLICIT);
    assert.equal(resolved.path, explicitPath);
  });
});

describe('loadVpsEnv', () => {
  test('lê valores do arquivo explícito e emite o caminho de origem', () => {
    const explicitPath = writeEnvFile('load-explicit.env', 'VPS_IP=10.2.2.2\nVPS_PG_PORT=15432\n');
    const loaded = loadVpsEnv({
      env: { [VPS_ENV_PATH_VAR]: explicitPath },
      cwd: sandbox,
      moduleUrl: moduleUrlInRepo(),
      warn: () => {},
    });
    assert.equal(loaded.source, ENV_SOURCE_EXPLICIT);
    assert.equal(loaded.path, explicitPath);
    assert.equal(loaded.values.VPS_IP, '10.2.2.2');
    assert.equal(loaded.values.VPS_PG_PORT, '15432');
  });

  test('fallback legado avisa com deprecation e sem vazar valores', () => {
    const warnings = [];
    const loaded = loadVpsEnv({
      env: {},
      cwd: sandbox,
      moduleUrl: moduleUrlInRepo(),
      warn: (message) => warnings.push(message),
    });
    assert.equal(loaded.source, ENV_SOURCE_LEGACY);
    assert.equal(loaded.values.VPS_STAGING_PASSWORD, 'segredo-staging-legado');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /\[deprecation\]/);
    assert.match(warnings[0], new RegExp(VPS_ENV_PATH_VAR));
    for (const value of Object.values(loaded.values)) {
      assert.ok(!warnings[0].includes(value), 'aviso nao pode conter valor de credencial');
    }
  });

  test('sem arquivo resolvido devolve valores vazios em vez de lançar', () => {
    const loaded = loadVpsEnv({
      env: {},
      cwd: sandbox,
      moduleUrl: pathToFileURL(join(isolatedRoot, 'scripts', 'lib', 'vps-env.mjs')).href,
      warn: () => {},
    });
    assert.deepEqual(loaded, { values: {}, path: null, source: ENV_SOURCE_NONE });
  });
});

describe('readVpsSetting — precedência process.env sobre arquivo', () => {
  test('process.env vence o arquivo', () => {
    assert.equal(
      readVpsSetting('VPS_IP', { env: { VPS_IP: '10.3.3.3' }, values: { VPS_IP: '10.4.4.4' } }),
      '10.3.3.3',
    );
  });

  test('valor vazio no env cai para o arquivo (compatível com `process.env.X || file.X`)', () => {
    assert.equal(
      readVpsSetting('VPS_IP', { env: { VPS_IP: '' }, values: { VPS_IP: '10.4.4.4' } }),
      '10.4.4.4',
    );
  });

  test('ausente em ambos retorna undefined', () => {
    assert.equal(readVpsSetting('VPS_IP', { env: {}, values: {} }), undefined);
  });

  test('credencial de staging nunca é preenchida com a de produção', () => {
    const values = { VPS_POSTGRES_PASSWORD: 'segredo-producao' };
    const read = readVpsSetting('VPS_STAGING_PASSWORD', { env: {}, values });
    assert.equal(read, undefined);
  });
});

describe('persistência de credenciais geradas/overridden', () => {
  test('sem arquivo de env, senha de staging gerada aborta (fail closed)', () => {
    assert.throws(
      () =>
        planEnvFileWrites({
          envPath: null,
          fileValues: {},
          overrides: { VPS_STAGING_PASSWORD: { value: 'segredo-gerado', required: true } },
        }),
      (err) => {
        assert.match(err.message, /Cannot persist generated VPS_STAGING_PASSWORD/);
        assert.match(err.message, new RegExp(VPS_ENV_PATH_VAR));
        assert.ok(!err.message.includes('segredo-gerado'), 'mensagem nao pode conter o segredo');
        return true;
      },
    );
  });

  test('assertEnvFileWritable recusa caminho inexistente antes de qualquer escrita', () => {
    assert.throws(
      () =>
        assertEnvFileWritable({
          envPath: join(sandbox, 'ausente', '.env'),
          writes: { VPS_STAGING_PASSWORD: 'segredo' },
        }),
      /does not exist/,
    );
  });

  test('assertEnvFileWritable recusa diretório', () => {
    assert.throws(
      () => assertEnvFileWritable({ envPath: sandbox, writes: { VPS_STAGING_PASSWORD: 'segredo' } }),
      /is not a regular file/,
    );
  });

  test('assertEnvFileWritable é no-op quando não há nada a persistir', () => {
    assert.equal(assertEnvFileWritable({ envPath: null, writes: {} }), null);
    assert.equal(assertEnvFileWritable({ envPath: sandbox, writes: {} }), null);
  });

  test('applyEnvFileWrites faz upsert atômico e não deixa temporário', () => {
    const target = writeEnvFile('write.env', 'VPS_IP=10.5.5.5\nVPS_POSTGRES_PASSWORD=antigo\n');
    const applied = applyEnvFileWrites(target, {
      VPS_POSTGRES_PASSWORD: 'novo-producao',
      VPS_STAGING_PASSWORD: 'novo-staging',
    });
    assert.equal(applied, true);
    const content = readFileSync(target, 'utf8');
    assert.match(content, /^VPS_IP=10\.5\.5\.5$/m);
    // valores persistidos ficam entre aspas simples POSIX
    assert.match(content, /^VPS_POSTGRES_PASSWORD='novo-producao'$/m);
    assert.match(content, /^VPS_STAGING_PASSWORD='novo-staging'$/m);
    assert.ok(!content.includes('antigo'));
    assert.deepEqual(
      readdirSync(sandbox).filter((name) => name.includes('synkroo-tmp')),
      [],
    );
    assert.deepEqual(parseVpsEnvContent(content), {
      VPS_IP: '10.5.5.5',
      VPS_POSTGRES_PASSWORD: 'novo-producao',
      VPS_STAGING_PASSWORD: 'novo-staging',
    });
  });

  test('applyEnvFileWrites é no-op sem writes', () => {
    const target = writeEnvFile('noop.env', 'VPS_IP=10.6.6.6\n');
    assert.equal(applyEnvFileWrites(target, {}), false);
    assert.equal(readFileSync(target, 'utf8'), 'VPS_IP=10.6.6.6\n');
  });

  test('upsertEnvValue anexa e substitui preservando o restante', () => {
    const base = 'A=1\nB=2\n';
    assert.equal(upsertEnvValue(base, 'B', 'novo'), "A=1\nB='novo'\n");
    assert.equal(upsertEnvValue(base, 'C', 'novo'), "A=1\nB=2\nC='novo'\n");
    assert.equal(upsertEnvValue('', 'C', 'novo'), "C='novo'\n");
  });

  test('chave com metacaractere de regex é escapada no upsert', () => {
    // Sem escape, `X.Y` casaria `XaY=1` e sobrescreveria a linha errada.
    const out = upsertEnvValue('XaY=1\n', 'X.Y', '2');
    assert.equal(out, "XaY=1\nX.Y='2'\n");
  });
});

describe('duplicatas de chave — last-wins nunca deixa credencial obsoleta', () => {
  test('upsert reescreve TODAS as ocorrências', () => {
    const base = [
      'VPS_STAGING_PASSWORD=antigo1',
      '# comentario no meio',
      '  VPS_STAGING_PASSWORD  =antigo2',
      "VPS_STAGING_PASSWORD='antigo3'",
      'VPS_IP=1.2.3.4',
      '',
    ].join('\n');
    const out = upsertEnvValue(base, 'VPS_STAGING_PASSWORD', 'novo');
    assert.equal(
      out,
      [
        "VPS_STAGING_PASSWORD='novo'",
        '# comentario no meio',
        "VPS_STAGING_PASSWORD='novo'",
        "VPS_STAGING_PASSWORD='novo'",
        'VPS_IP=1.2.3.4',
        '',
      ].join('\n'),
    );
    assert.ok(!out.includes('antigo'));
  });

  test('nenhuma ocorrência obsoleta sobrevive ao parse (last-wins)', () => {
    const base = ['VPS_STAGING_PASSWORD=antigo1', "VPS_STAGING_PASSWORD='antigo2'", ''].join('\n');
    const parsed = parseVpsEnvContent(upsertEnvValue(base, 'VPS_STAGING_PASSWORD', 'novo'));
    assert.equal(parsed.VPS_STAGING_PASSWORD, 'novo');
  });

  test('sem escrita, o parse continua last-wins (comportamento preexistente)', () => {
    const parsed = parseVpsEnvContent('K=um\nK=dois\n');
    assert.equal(parsed.K, 'dois');
  });
});

describe('serialização reversível de valores', () => {
  const HOSTILE = ["$&", '$$', "$'", '$`', 'a$&b$$c$d\'e$f`g'].join('|');

  test('aspas simples são escapadas com o idiom POSIX', () => {
    assert.equal(encodeEnvValue('a'), "'a'");
    assert.equal(encodeEnvValue(''), "''");
    assert.equal(encodeEnvValue("a'b"), "'a'\\''b'");
    // valor que começa com aspa: segmento vazio + escape + conteúdo
    assert.equal(encodeEnvValue("'a'"), "''\\''a'\\'''");
    assert.equal(encodeEnvValue("a\"b"), '\'a"b\'');
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue("'a'")}`).K, "'a'");
  });

  test('NUL, CR e LF são rejeitados antes de qualquer escrita', () => {
    for (const bad of [`a${NUL}b`, 'a\rb', 'a\nb']) {
      assert.throws(() => encodeEnvValue(bad, 'VPS_STAGING_PASSWORD'), (err) => {
        assert.equal(err.code, ENV_VALUE_UNREPRESENTABLE_CODE);
        assert.match(err.message, /VPS_STAGING_PASSWORD/);
        return true;
      });
    }
    // a falha acontece no upsert (portão de escrita), sem tocar o arquivo
    const target = writeEnvFile('nul.env', 'K=ok\n');
    assert.throws(
      () => applyEnvFileWrites(target, { K: `x${NUL}y` }),
      /cannot represent/,
    );
    assert.equal(readFileSync(target, 'utf8'), 'K=ok\n', 'arquivo deve ficar intacto');
  });

  test('round-trip exato: espaços nas bordas', () => {
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue('  padded  ')}`).K, '  padded  ');
  });

  test('round-trip exato: aspas simples nas bordas', () => {
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue("'lead'")}`).K, "'lead'");
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue("'")}`).K, "'");
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue("''")}`).K, "''");
  });

  test('round-trip exato: aspas duplas nas bordas', () => {
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue('"lead"')}`).K, '"lead"');
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue('"')}`).K, '"');
  });

  test('round-trip exato: apóstrofos, barras e metacaracteres de shell', () => {
    for (const value of [
      "it's",
      "'''",
      "a'b'c'd",
      'a\\b',
      'a\\\\b',
      '; rm -rf /',
      '$(id)',
      '`id`',
      'a b\tc',
      '~home $HOME *glob',
    ]) {
      assert.equal(parseVpsEnvContent(`K=${encodeEnvValue(value)}`).K, value, value);
    }
  });

  test('round-trip exato: padrões $&, $$, $\' e $`', () => {
    for (const value of ['$&', '$$', "$'", '$`', HOSTILE, 'a$&\nb$$c']) {
      if (/[\n]/.test(value)) continue;
      assert.equal(parseVpsEnvContent(`K=${encodeEnvValue(value)}`).K, value, value);
    }
  });

  test('round-trip completo por arquivo: valor-hostil sobrevive ao write+read', () => {
    const target = writeEnvFile('hostile.env', 'VPS_IP=9.9.9.9\n');
    for (const value of ['  lead e trail  ', "'quoted'", '"dq"', 'a$b`c;d\\e', HOSTILE]) {
      applyEnvFileWrites(target, { VPS_STAGING_PASSWORD: value });
      const parsed = parseVpsEnvContent(readFileSync(target, 'utf8'));
      assert.equal(parsed.VPS_STAGING_PASSWORD, value, value);
      assert.equal(parsed.VPS_IP, '9.9.9.9', 'chave vizinha preservada');
    }
  });

  test('formato gravado é fonteável pelo shell POSIX (sem evaluating)', () => {
    const value = '  sp ace  ; rm -rf / $(id) `id` $HOME ';
    const line = `K=${encodeEnvValue(value)}`;
    // Nenhum byte fora das aspas simples: um valor com espaço/metacaractere
    // nunca pode sair de dentro do literal.
    assert.equal(line.slice(2, -1).includes("'"), true, 'aspas internas escapadas');
    assert.deepEqual(parseVpsEnvContent(line), { K: value });
  });

  test('valores legados continuam legíveis', () => {
    assert.deepEqual(parseVpsEnvContent('A=bare\nB="dq"\nC=\'sq\'\nD=  padded  \n'), {
      A: 'bare',
      B: 'dq',
      C: 'sq',
      D: 'padded',
    });
  });

  test('persistência mantém o comportamento fail-closed do segredo gerado', () => {
    assert.throws(
      () =>
        planEnvFileWrites({
          envPath: null,
          fileValues: {},
          overrides: { VPS_STAGING_PASSWORD: { value: 'gerada', required: true } },
        }),
      /Cannot persist generated VPS_STAGING_PASSWORD/,
    );
    // segredo vindo de process.env sem arquivo: não há o que persistir, então
    // não aborta (fonte externa)
    assert.deepEqual(
      planEnvFileWrites({
        envPath: null,
        fileValues: {},
        overrides: { VPS_STAGING_PASSWORD: { value: 'do-env', required: false } },
      }).writes,
      {},
    );
  });
});

describe('upsertEnvValue — padrões de substituição $', () => {
  // Com replacement string, `$&`/`$$`/`$'`/``$` `` são expandidos e a
  // credencial persistida fica corrompida. O callback impede a expansão.
  const HOSTILE = ["$&", '$$', "$'", '$`', 'a$&b$$c$d\'e$f`g'].join('|');

  test('substituição preserva $&, $$, $\' e $` literalmente', () => {
    const replaced = upsertEnvValue('VPS_STAGING_PASSWORD=antigo\n', 'VPS_STAGING_PASSWORD', HOSTILE);
    assert.equal(replaced, `VPS_STAGING_PASSWORD=${encodeEnvValue(HOSTILE)}\n`);
    assert.equal(parseVpsEnvContent(replaced).VPS_STAGING_PASSWORD, HOSTILE);
  });

  test('append também preserva os padrões literalmente', () => {
    const appended = upsertEnvValue('VPS_IP=1.2.3.4\n', 'VPS_STAGING_PASSWORD', HOSTILE);
    assert.equal(appended, `VPS_IP=1.2.3.4\nVPS_STAGING_PASSWORD=${encodeEnvValue(HOSTILE)}\n`);
    assert.equal(parseVpsEnvContent(appended).VPS_STAGING_PASSWORD, HOSTILE);
  });

  test('round-trip: gravar e reler devolve exatamente a mesma senha', () => {
    const target = writeEnvFile('roundtrip.env', 'VPS_STAGING_PASSWORD=antigo\n');
    applyEnvFileWrites(target, { VPS_STAGING_PASSWORD: HOSTILE });
    const reloaded = parseVpsEnvContent(readFileSync(target, 'utf8'));
    assert.equal(reloaded.VPS_STAGING_PASSWORD, HOSTILE);
  });

  test('round-trip de senha com aspas e espaços sobrevive ao arquivo', () => {
    const messy = `p'w "x" com espaco \\ back`;
    const target = writeEnvFile('roundtrip-messy.env', '');
    applyEnvFileWrites(target, { VPS_STAGING_PASSWORD: messy });
    assert.equal(parseVpsEnvContent(readFileSync(target, 'utf8')).VPS_STAGING_PASSWORD, messy);
  });
});

describe('modo do arquivo de credenciais', () => {
  test('a constante de modo é 0600 (owner-only)', () => {
    assert.equal(CREDENTIAL_FILE_MODE, 0o600);
  });

  test('applyEnvFileWrites grava sempre com 0600 e não reaproveita o modo antigo', () => {
    const src = readFileSync(resolve(root, 'scripts', 'lib', 'vps-env.mjs'), 'utf8');
    assert.match(src, /writeFileSync\(tempPath, next, \{ encoding: 'utf8', mode: CREDENTIAL_FILE_MODE \}\)/);
    assert.ok(!/existingMode/.test(src), 'não deve reaproveitar a permissão anterior do arquivo');
  });

  test(
    'a substituição usa 0600 e não preserva permissão group/world-readable (POSIX)',
    { skip: process.platform === 'win32' ? 'POSIX modes only' : false },
    () => {
      const target = writeEnvFile('mode.env', 'VPS_STAGING_PASSWORD=antigo\n');
      chmodSync(target, 0o644);
      assert.equal(statSync(target).mode & 0o777, 0o644);
      applyEnvFileWrites(target, { VPS_STAGING_PASSWORD: 'novo' });
      assert.equal(statSync(target).mode & 0o777, CREDENTIAL_FILE_MODE);
      assert.equal(statSync(target).mode & 0o077, 0, 'nenhum bit de grupo/outro');
    },
  );
});

describe('persistência da senha de staging efetiva', () => {
  test('senha gerada é required: aborta sem arquivo de env', () => {
    assert.throws(
      () =>
        planEnvFileWrites({
          envPath: null,
          fileValues: {},
          overrides: { VPS_STAGING_PASSWORD: { value: 'gerada', required: true } },
        }),
      /Cannot persist generated VPS_STAGING_PASSWORD/,
    );
  });

  test('override de process.env divergente sincroniza o arquivo existente', () => {
    const { writes } = planEnvFileWrites({
      envPath: '/tmp/.env',
      fileValues: { VPS_STAGING_PASSWORD: 'antigo-do-arquivo' },
      overrides: { VPS_STAGING_PASSWORD: { value: 'novo-do-env', required: false } },
    });
    assert.deepEqual(writes, { VPS_STAGING_PASSWORD: 'novo-do-env' });
  });

  test('override de process.env igual ao arquivo não gera escrita', () => {
    const { writes } = planEnvFileWrites({
      envPath: '/tmp/.env',
      fileValues: { VPS_STAGING_PASSWORD: 'mesma' },
      overrides: { VPS_STAGING_PASSWORD: { value: 'mesma', required: false } },
    });
    assert.deepEqual(writes, {});
  });

  test('chave ausente no arquivo é sincronizada pelo valor efetivo', () => {
    const { writes } = planEnvFileWrites({
      envPath: '/tmp/.env',
      fileValues: {},
      overrides: { VPS_STAGING_PASSWORD: { value: 'novo-do-env', required: false } },
    });
    assert.deepEqual(writes, { VPS_STAGING_PASSWORD: 'novo-do-env' });
  });

  test('readVpsSettingWithOrigin distingue process.env de arquivo', () => {
    assert.deepEqual(
      readVpsSettingWithOrigin('VPS_STAGING_PASSWORD', {
        env: { VPS_STAGING_PASSWORD: 'do-env' },
        values: { VPS_STAGING_PASSWORD: 'do-arquivo' },
      }),
      { value: 'do-env', origin: SETTING_ORIGIN_PROCESS },
    );
    assert.deepEqual(
      readVpsSettingWithOrigin('VPS_STAGING_PASSWORD', {
        env: {},
        values: { VPS_STAGING_PASSWORD: 'do-arquivo' },
      }),
      { value: 'do-arquivo', origin: SETTING_ORIGIN_FILE },
    );
    assert.deepEqual(
      readVpsSettingWithOrigin('VPS_STAGING_PASSWORD', { env: {}, values: {} }),
      { value: undefined, origin: undefined },
    );
  });

  test('setup-staging-db planeja as duas chaves e escreve antes do connect', () => {
    const src = readFileSync(resolve(root, 'scripts', 'setup-staging-db.ts'), 'utf8');
    // A chave de destino vem do side resolvido (prefixada ou alias genérico),
    // então o override é indexado pelo nome derivado, não por um literal fixo.
    assert.match(src, /\[stagingKey\]: \{ value: stagingPassword, required: stagingGenerated \}/);
    assert.match(src, /\[postgresKey\]: \{ value: prodPassword, required: false \}/);
    const writeIndex = src.indexOf('applyEnvFileWrites(target, writes)');
    const connectIndex = src.indexOf('adminClient.connect()');
    assert.ok(writeIndex > 0 && connectIndex > 0 && writeIndex < connectIndex);
  });
});

describe('os três scripts consomem o módulo compartilhado', () => {
  const scripts = ['migrate-vps.ts', 'update-hyperdrive.ts', 'setup-staging-db.ts'];

  for (const name of scripts) {
    test(`${name} usa o resolver compartilhado e não fixa ../vps-hostinger em código`, () => {
      const src = readFileSync(resolve(root, 'scripts', name), 'utf8');
      assert.match(src, /from '\.\/lib\/vps-env\.mjs'/);
      assert.ok(
        !src.includes("'..', 'vps-hostinger'"),
        `${name} ainda fixa o caminho legado provider-specific`,
      );
      assert.ok(!src.includes('vps-contabo'), `${name} não deve introduzir literal de provider alvo`);
    });
  }

  test('as mensagens de erro apontam para SYNKROO_VPS_ENV, não para o caminho legado', () => {
    for (const name of scripts) {
      const src = readFileSync(resolve(root, 'scripts', name), 'utf8');
      assert.ok(
        !/process\.env or \.\.\/vps-hostinger/.test(src),
        `${name} ainda referencia o caminho legado nas mensagens`,
      );
      assert.ok(!src.includes('from ../vps-hostinger/.env'), `${name} referencia caminho legado em log`);
    }
  });

  test('setup-staging-db valida a persistência antes de conectar ao banco', () => {
    const src = readFileSync(resolve(root, 'scripts', 'setup-staging-db.ts'), 'utf8');
    const assertIndex = src.indexOf('assertEnvFileWritable(');
    const connectIndex = src.indexOf('adminClient.connect()');
    assert.ok(assertIndex > 0 && connectIndex > 0);
    assert.ok(
      assertIndex < connectIndex,
      'assertEnvFileWritable deve rodar antes de qualquer mutação no banco',
    );
  });

  test('setup-staging-db mantém a separação staging/produção', () => {
    const src = readFileSync(resolve(root, 'scripts', 'setup-staging-db.ts'), 'utf8');
    // A separação passa a ser estrutural: nenhuma credencial cruza de campo
    // (staging nunca é preenchida com a de produção) e o destino da escrita é a
    // chave de origem do valor efetivo.
    assert.match(src, /resolveVpsSideSettings\(side, \{/);
    assert.match(src, /require: \['IP', 'PG_PORT', 'POSTGRES_PASSWORD'\]/);
    assert.match(src, /stagingPassword = settings\.stagingPassword/);
    assert.match(src, /const stagingKey = settings\.keys\.stagingPassword;/);
    assert.ok(
      !/readVpsSetting(?:WithOrigin)?\(/.test(src),
      'setup-staging-db não deve ler chaves VPS_* diretamente: a resolução é do resolver por side',
    );
  });
});

describe('parseVpsPort — validação estrita de porta', () => {
  test('porta válida é convertida para número', () => {
    assert.equal(parseVpsPort('5432', 'VPS_SOURCE_PG_PORT'), 5432);
    assert.equal(parseVpsPort(' 15432 ', 'VPS_SOURCE_PG_PORT'), 15432);
    assert.equal(parseVpsPort('1', 'VPS_SOURCE_PG_PORT'), 1);
    assert.equal(parseVpsPort('65535', 'VPS_TARGET_PG_PORT'), 65535);
  });

  test('vazio, NaN, fora de faixa e sufixo textual abortam citando a chave', () => {
    for (const bad of ['', '   ', 'abc', '5432abc', '0', '70000', '-1', '1e3', '0x10']) {
      assert.throws(
        () => parseVpsPort(bad, 'VPS_TARGET_PG_PORT'),
        (err) => {
          assert.equal(err.code, VPS_PORT_INVALID_CODE);
          assert.match(err.message, /VPS_TARGET_PG_PORT/);
          assert.ok(
            bad === '' || !err.message.includes(bad),
            'a mensagem não deve ecoar o valor',
          );
          return true;
        },
        `valor ${JSON.stringify(bad)} deveria ser rejeitado`,
      );
    }
    assert.throws(() => parseVpsPort(undefined, 'VPS_SOURCE_PG_PORT'), /VPS_SOURCE_PG_PORT/);
    assert.throws(() => parseVpsPort(null, 'VPS_SOURCE_PG_PORT'), /VPS_SOURCE_PG_PORT/);
  });
});

describe('readCliFlag — --name=value e --name value', () => {
  test('as duas grafias são equivalentes', () => {
    assert.equal(readCliFlag(['--side=target'], 'side'), 'target');
    assert.equal(readCliFlag(['--side', 'target'], 'side'), 'target');
    assert.equal(readCliFlag(['--target=all', '--side=source'], 'side'), 'source');
  });

  test('flag ausente, sem valor ou seguida de outra flag retorna undefined', () => {
    assert.equal(readCliFlag([], 'side'), undefined);
    assert.equal(readCliFlag(['--target=all'], 'side'), undefined);
    assert.equal(readCliFlag(['--side'], 'side'), undefined);
    // A próxima flag não pode ser consumida como valor de --side.
    assert.equal(readCliFlag(['--side', '--target=all'], 'side'), undefined);
    assert.equal(readCliFlag(['--side='], 'side'), '');
  });

  test('--sideAccepted não é confundido com --side', () => {
    assert.equal(readCliFlag(['--sideAccepted=x'], 'side'), undefined);
  });
});

describe('resolveVpsSideSettings — contrato source/target', () => {
  const PREFIXED = {
    VPS_SOURCE_IP: '10.0.0.1',
    VPS_SOURCE_PG_PORT: '15432',
    VPS_SOURCE_POSTGRES_PASSWORD: 'segredo-producao-prefixado',
    VPS_SOURCE_STAGING_PASSWORD: 'segredo-staging-prefixado',
  };
  const LEGACY = {
    VPS_IP: '10.9.9.9',
    VPS_PG_PORT: '25432',
    VPS_POSTGRES_PASSWORD: 'segredo-producao-generico',
    VPS_STAGING_PASSWORD: 'segredo-staging-generico',
  };

  test('a chave prefixada vence a genérica em todos os campos', () => {
    const settings = resolveVpsSideSettings('source', {
      env: {},
      values: { ...LEGACY, ...PREFIXED },
      warn: () => {},
    });
    assert.equal(settings.side, 'source');
    assert.equal(settings.ip, '10.0.0.1');
    assert.equal(settings.pgPort, 15432);
    assert.equal(settings.postgresPassword, 'segredo-producao-prefixado');
    assert.equal(settings.stagingPassword, 'segredo-staging-prefixado');
    assert.deepEqual(settings.usedLegacyKeys, []);
    assert.deepEqual(settings.keys, {
      ip: 'VPS_SOURCE_IP',
      pgPort: 'VPS_SOURCE_PG_PORT',
      postgresPassword: 'VPS_SOURCE_POSTGRES_PASSWORD',
      stagingPassword: 'VPS_SOURCE_STAGING_PASSWORD',
    });
  });

  test('process.env prefixado também vence a genérica do arquivo', () => {
    const settings = resolveVpsSideSettings('source', {
      env: { VPS_SOURCE_IP: '10.5.5.5' },
      values: { ...LEGACY, ...PREFIXED },
      warn: () => {},
    });
    assert.equal(settings.ip, '10.5.5.5');
    assert.equal(settings.origins.ip, SETTING_ORIGIN_PROCESS);
  });

  test('os dois lados não se misturam: source lê VPS_SOURCE_*, target lê VPS_TARGET_*', () => {
    const values = {
      ...LEGACY,
      ...PREFIXED,
      VPS_TARGET_IP: '10.7.7.7',
      VPS_TARGET_PG_PORT: '35432',
      VPS_TARGET_POSTGRES_PASSWORD: 'segredo-producao-alvo',
      VPS_TARGET_STAGING_PASSWORD: 'segredo-staging-alvo',
    };
    const warnings = [];
    const target = resolveVpsSideSettings('target', { env: {}, values, warn: (m) => warnings.push(m) });
    assert.equal(target.ip, '10.7.7.7');
    assert.equal(target.pgPort, 35432);
    assert.equal(target.stagingPassword, 'segredo-staging-alvo');
    assert.equal(target.keys.ip, 'VPS_TARGET_IP');
    // O source não enxerga nada do target: cada lado é resolvido isoladamente.
    const source = resolveVpsSideSettings('source', { env: {}, values, warn: () => {} });
    assert.equal(source.ip, '10.0.0.1');
    assert.equal(source.stagingPassword, 'segredo-staging-prefixado');
    assert.deepEqual(warnings, [], 'nenhum alias genérico foi usado');
  });

  test('fallback por chave genérica registra usedLegacyKeys e avisa 1x por chave, sem valor', () => {
    const warnings = [];
    const settings = resolveVpsSideSettings('target', {
      env: {},
      values: LEGACY,
      warn: (message) => warnings.push(message),
    });
    assert.equal(settings.ip, '10.9.9.9');
    assert.equal(settings.pgPort, 25432);
    assert.equal(settings.postgresPassword, 'segredo-producao-generico');
    assert.equal(settings.stagingPassword, 'segredo-staging-generico');
    assert.deepEqual(settings.usedLegacyKeys, [
      'VPS_IP',
      'VPS_PG_PORT',
      'VPS_POSTGRES_PASSWORD',
      'VPS_STAGING_PASSWORD',
    ]);
    // A chave de destino acompanha a origem do valor (comportamento atual).
    assert.equal(settings.keys.stagingPassword, 'VPS_STAGING_PASSWORD');
    assert.equal(settings.keys.ip, 'VPS_IP');

    assert.equal(warnings.length, 4, 'um aviso por chave genérica usada');
    for (const warning of warnings) {
      assert.match(warning, /^\[deprecated\] chave genérica /);
      assert.match(warning, /atualize o \.env para a chave prefixada/);
    }
    assert.match(warnings[0], /VPS_IP usada para VPS_TARGET_IP/);
    for (const value of Object.values(LEGACY)) {
      assert.ok(
        !warnings.some((warning) => warning.includes(value)),
        'aviso não pode conter valor de credencial nem IP/porta',
      );
    }
  });

  test('prefixado vazio em process.env e ausente no arquivo cai para o genérico', () => {
    const warnings = [];
    const settings = resolveVpsSideSettings('source', {
      env: { VPS_SOURCE_PG_PORT: '' },
      values: {
        VPS_SOURCE_IP: '10.0.0.1',
        VPS_SOURCE_POSTGRES_PASSWORD: 'segredo-producao',
        VPS_SOURCE_STAGING_PASSWORD: 'segredo-staging',
        VPS_PG_PORT: '25432',
      },
      warn: (message) => warnings.push(message),
    });
    // Mesma regra de antes: valor vazio/unset cai através, e o alias usado é
    // registrado como tal (inclusive a chave que o portão de escrita deve usar).
    assert.equal(settings.pgPort, 25432);
    assert.deepEqual(settings.usedLegacyKeys, ['VPS_PG_PORT']);
    assert.equal(settings.keys.pgPort, 'VPS_PG_PORT');
    assert.equal(warnings.length, 1);
  });

  test('o prefixado válido no arquivo vence o genérico mesmo vazio no process.env', () => {
    const warnings = [];
    const settings = resolveVpsSideSettings('source', {
      env: { VPS_SOURCE_PG_PORT: '' },
      values: { ...PREFIXED, VPS_PG_PORT: '25432' },
      warn: (message) => warnings.push(message),
    });
    assert.equal(settings.pgPort, 15432);
    assert.deepEqual(settings.usedLegacyKeys, []);
    assert.deepEqual(warnings, []);
  });

  test('ausente em ambas aborta fail closed citando a chave prefixada', () => {
    assert.throws(
      () => resolveVpsSideSettings('target', { env: {}, values: { VPS_IP: '10.9.9.9' }, warn: () => {} }),
      (err) => {
        assert.equal(err.code, VPS_SETTING_MISSING_CODE);
        assert.match(err.message, /VPS_TARGET_PG_PORT is missing/);
        return true;
      },
    );
    assert.throws(
      () => resolveVpsSideSettings('target', { env: {}, values: {}, warn: () => {} }),
      /VPS_TARGET_IP is missing/,
    );
    // A primeira ausente no mais interno (IP, PG_PORT, senhas) é a reportada.
    assert.throws(
      () => resolveVpsSideSettings('source', { env: {}, values: {}, warn: () => {} }),
      (err) => {
        assert.equal(err.code, VPS_SETTING_MISSING_CODE);
        assert.match(err.message, /VPS_SOURCE_IP is missing/);
        return true;
      },
    );
    assert.throws(
      () =>
        resolveVpsSideSettings('source', {
          env: {},
          values: { VPS_SOURCE_IP: '10.0.0.1', VPS_SOURCE_PG_PORT: '15432' },
          warn: () => {},
        }),
      /VPS_SOURCE_POSTGRES_PASSWORD is missing/,
    );
  });

  test('a mensagem de ausência nomeia a chave e a origem, nunca um valor', () => {
    assert.throws(
      () =>
        resolveVpsSideSettings('target', {
          env: {},
          values: {},
          hint: `SYNKROO_VPS_ENV=${legacyEnvPath}`,
          warn: () => {},
        }),
      (err) => {
        assert.match(err.message, /set it in process\.env or SYNKROO_VPS_ENV=/);
        assert.ok(!/segredo/.test(err.message));
        return true;
      },
    );
  });

  test('campo não exigido fica undefined mas a chave de destino já é a prefixada', () => {
    const warnings = [];
    const settings = resolveVpsSideSettings('source', {
      env: {},
      values: {
        VPS_SOURCE_IP: '10.0.0.1',
        VPS_SOURCE_PG_PORT: '15432',
        VPS_SOURCE_POSTGRES_PASSWORD: 'segredo-producao',
      },
      require: ['IP', 'PG_PORT', 'POSTGRES_PASSWORD'],
      warn: (message) => warnings.push(message),
    });
    assert.equal(settings.stagingPassword, undefined);
    assert.equal(settings.origins.stagingPassword, undefined);
    assert.equal(settings.keys.stagingPassword, 'VPS_SOURCE_STAGING_PASSWORD');
    assert.deepEqual(settings.usedLegacyKeys, []);
    assert.deepEqual(warnings, []);
  });

  test('side ausente ou inválido aborta com SYNKROO_VPS_SIDE_INVALID e lista os lados', () => {
    for (const bad of [undefined, null, '', '  ', 'origin', 'SOURCE-1', 'prod']) {
      assert.throws(
        () => resolveVpsSideSettings(bad, { env: {}, values: PREFIXED, warn: () => {} }),
        (err) => {
          assert.equal(err.code, VPS_SIDE_INVALID_CODE);
          assert.match(err.message, /--side=source/);
          assert.match(err.message, /--side=target/);
          return true;
        },
        `side ${JSON.stringify(bad)} deveria ser rejeitado`,
      );
    }
  });

  test('side é normalizado (trim + case) e a chave usada reflete o valor normalizado', () => {
    const settings = resolveVpsSideSettings(' TARGET ', {
      env: {},
      values: {
        ...PREFIXED,
        VPS_TARGET_IP: '10.7.7.7',
        VPS_TARGET_PG_PORT: '35432',
        VPS_TARGET_POSTGRES_PASSWORD: 'alvo-producao',
        VPS_TARGET_STAGING_PASSWORD: 'alvo-staging',
      },
      warn: () => {},
    });
    assert.equal(settings.side, 'target');
    assert.equal(settings.ip, '10.7.7.7');
    assert.equal(settings.pgPort, 35432);
    assert.equal(settings.keys.stagingPassword, 'VPS_TARGET_STAGING_PASSWORD');
  });

  test('a porta inválida aborta com o code de porta, citando a chave resolvida', () => {
    const targetBase = {
      VPS_TARGET_IP: '10.7.7.7',
      VPS_TARGET_POSTGRES_PASSWORD: 'alvo-producao',
      VPS_TARGET_STAGING_PASSWORD: 'alvo-staging',
    };
    assert.throws(
      () =>
        resolveVpsSideSettings('target', {
          env: {},
          values: { ...targetBase, VPS_TARGET_PG_PORT: 'portao' },
          warn: () => {},
        }),
      (err) => {
        assert.equal(err.code, VPS_PORT_INVALID_CODE);
        assert.match(err.message, /VPS_TARGET_PG_PORT/);
        return true;
      },
    );
    // Alias genérico inválido também é rejeitado, citando a chave genérica.
    assert.throws(
      () =>
        resolveVpsSideSettings('source', {
          env: {},
          values: {
            VPS_SOURCE_IP: '10.0.0.1',
            VPS_SOURCE_POSTGRES_PASSWORD: 'segredo-producao',
            VPS_SOURCE_STAGING_PASSWORD: 'segredo-staging',
            VPS_PG_PORT: '70000',
          },
          warn: () => {},
        }),
      (err) => {
        assert.equal(err.code, VPS_PORT_INVALID_CODE);
        assert.match(err.message, /VPS_PG_PORT/);
        return true;
      },
    );
  });

  test('os campos e lados exportados são exatamente os do contrato', () => {
    assert.deepEqual([...VPS_SIDES], ['source', 'target']);
    assert.deepEqual([...VPS_SIDE_FIELDS], [
      'IP',
      'PG_PORT',
      'POSTGRES_PASSWORD',
      'STAGING_PASSWORD',
    ]);
  });

  test('requireVpsSideSetting estreita um campo opcional ou falha fechado com a chave', () => {
    const settings = resolveVpsSideSettings('target', {
      env: {},
      values: {
        VPS_TARGET_IP: '10.7.7.7',
        VPS_TARGET_PG_PORT: '35432',
        VPS_TARGET_POSTGRES_PASSWORD: 'alvo-producao',
      },
      require: ['IP', 'PG_PORT', 'POSTGRES_PASSWORD'],
      warn: () => {},
    });
    assert.equal(requireVpsSideSetting(settings, 'ip', 'hint'), '10.7.7.7');
    assert.equal(requireVpsSideSetting(settings, 'pgPort', 'hint'), 35432);
    assert.equal(requireVpsSideSetting(settings, 'postgresPassword', 'hint'), 'alvo-producao');
    // A senha ausente de staging NÃO pode ser usada: falha fechada, e a mensagem
    // cita a chave prefixada (a que o operador deve criar), nunca um valor.
    assert.throws(
      () => requireVpsSideSetting(settings, 'stagingPassword', `SYNKROO_VPS_ENV=${legacyEnvPath}`),
      (err) => {
        assert.equal(err.code, VPS_SETTING_MISSING_CODE);
        assert.match(err.message, /VPS_TARGET_STAGING_PASSWORD is missing/);
        assert.match(err.message, /SYNKROO_VPS_ENV=/);
        return true;
      },
    );
  });

  test('os três scripts exigem --side e resolvem por side', () => {
    for (const name of ['migrate-vps.ts', 'update-hyperdrive.ts', 'setup-staging-db.ts']) {
      const src = readFileSync(resolve(root, 'scripts', name), 'utf8');
      assert.match(src, /resolveVpsSideSettings\(/, `${name} deve resolver as chaves por side`);
      assert.match(
        src,
        /readCliFlag\(.*'side'\)/,
        `${name} deve ler --side de forma obrigatório`,
      );
      assert.ok(
        /VPS_SIDE_INVALID_CODE/.test(src),
        `${name} deve citar o code de side inválido na mensagem`,
      );
      assert.match(src, /side=\$\{side\} host=/, `${name} deve rotular a execução com o side`);
    }
  });
});

describe('roteamento da chave de gravação - fluxo real do setup-staging-db', () => {
  // Espelha o pipeline completo resolveVpsSideSettings → planEnvFileWrites →
  // assertEnvFileWritable → applyEnvFileWrites → reparse, travando por teste
  // funcional (não só regex de fonte) o contrato: credencial gerada/ausente
  // grava na chave PREFIXADA; alias genérico em uso grava no próprio alias.
  test('senha de staging gerada com .env só genérico grava na chave prefixada sem ressuscitar o alias', () => {
    const envPath = writeEnvFile(
      'route-generated.env',
      'VPS_IP=10.7.0.1\nVPS_PG_PORT=15432\nVPS_POSTGRES_PASSWORD=prod-do-arquivo\n',
    );
    const values = parseVpsEnvContent(readFileSync(envPath, 'utf8'));
    const warnings = [];
    const settings = resolveVpsSideSettings('target', {
      env: {},
      values,
      require: ['IP', 'PG_PORT', 'POSTGRES_PASSWORD'],
      warn: (message) => warnings.push(message),
    });
    // stagingPassword ausente → cenário "gerada": destino é a PREFIXADA.
    assert.equal(settings.stagingPassword, undefined);
    assert.equal(settings.keys.stagingPassword, 'VPS_TARGET_STAGING_PASSWORD');
    // Alias genérico em uso nos demais campos → destino continua o próprio alias.
    assert.equal(settings.keys.postgresPassword, 'VPS_POSTGRES_PASSWORD');
    assert.deepEqual(settings.usedLegacyKeys, ['VPS_IP', 'VPS_PG_PORT', 'VPS_POSTGRES_PASSWORD']);

    const stagingPassword = 'staging-gerada-no-teste';
    const { writes } = planEnvFileWrites({
      envPath,
      fileValues: values,
      overrides: {
        [settings.keys.stagingPassword]: { value: stagingPassword, required: true },
        [settings.keys.postgresPassword]: { value: settings.postgresPassword, required: false },
      },
    });
    // Só a staging é gravada: o valor de produção veio igual do arquivo.
    assert.deepEqual(writes, { VPS_TARGET_STAGING_PASSWORD: stagingPassword });

    const target = assertEnvFileWritable({ envPath, writes });
    assert.equal(target, envPath);
    applyEnvFileWrites(target, writes);
    const reparsed = parseVpsEnvContent(readFileSync(envPath, 'utf8'));
    assert.equal(reparsed.VPS_TARGET_STAGING_PASSWORD, stagingPassword);
    assert.ok(
      !('VPS_STAGING_PASSWORD' in reparsed),
      'alias genérico de staging não deve ser ressuscitado pela gravação',
    );
    assert.equal(reparsed.VPS_IP, '10.7.0.1');
    assert.equal(reparsed.VPS_POSTGRES_PASSWORD, 'prod-do-arquivo');
  });

  test('override prefixado via process.env grava na prefixada e preserva o alias genérico órfão', () => {
    const envPath = writeEnvFile(
      'route-override.env',
      'VPS_IP=10.7.0.2\nVPS_PG_PORT=15432\nVPS_POSTGRES_PASSWORD=prod-do-arquivo\nVPS_STAGING_PASSWORD=staging-antigo-do-arquivo\n',
    );
    const values = parseVpsEnvContent(readFileSync(envPath, 'utf8'));
    const settings = resolveVpsSideSettings('target', {
      env: { VPS_TARGET_STAGING_PASSWORD: 'staging-novo-do-process-env' },
      values,
      warn: () => {},
    });
    // Prefixada vence: valor e destino vêm dela; o genérico nem é lido p/ staging.
    assert.equal(settings.stagingPassword, 'staging-novo-do-process-env');
    assert.equal(settings.keys.stagingPassword, 'VPS_TARGET_STAGING_PASSWORD');
    assert.equal(settings.origins.stagingPassword, SETTING_ORIGIN_PROCESS);
    assert.ok(!settings.usedLegacyKeys.includes('VPS_STAGING_PASSWORD'));

    const { writes } = planEnvFileWrites({
      envPath,
      fileValues: values,
      overrides: {
        [settings.keys.stagingPassword]: { value: settings.stagingPassword, required: false },
        [settings.keys.postgresPassword]: { value: settings.postgresPassword, required: false },
      },
    });
    // Staging difere do arquivo (na prefixada, ausente) → grava; produção é igual → não grava.
    assert.deepEqual(writes, { VPS_TARGET_STAGING_PASSWORD: 'staging-novo-do-process-env' });

    applyEnvFileWrites(assertEnvFileWritable({ envPath, writes }), writes);
    const reparsed = parseVpsEnvContent(readFileSync(envPath, 'utf8'));
    assert.equal(reparsed.VPS_TARGET_STAGING_PASSWORD, 'staging-novo-do-process-env');
    // Órfão preservado sem ambiguidade: a próxima leitura prefere a prefixada.
    assert.equal(reparsed.VPS_STAGING_PASSWORD, 'staging-antigo-do-arquivo');
    // Round-trip: o resolver passa a ver o novo valor direto da prefixada.
    const reread = resolveVpsSideSettings('target', { env: {}, values: reparsed, warn: () => {} });
    assert.equal(reread.stagingPassword, 'staging-novo-do-process-env');
    assert.ok(!reread.usedLegacyKeys.includes('VPS_STAGING_PASSWORD'));
  });
});

describe('fonte do módulo', () => {
  test('o módulo compartilhado não embute literal de provider alvo', () => {
    assert.ok(!libSrc.includes('vps-contabo'));
  });

  test('o módulo não usa process.cwd() para derivar o caminho legado', () => {
    const legacyFn = libSrc.slice(libSrc.indexOf('export function legacyVpsEnvPathFrom'));
    assert.ok(
      !legacyFn.slice(0, legacyFn.indexOf('}')).includes('process.cwd()'),
      'o fallback legado não pode depender de process.cwd()',
    );
  });
});
